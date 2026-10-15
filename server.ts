import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Allow large base64 images (up to 15MB)
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/parse-timetable', async (req, res) => {
    // Experimental feature: off unless the operator explicitly enables it, so a
    // public deployment cannot spend Gemini quota before the feature is released.
    if (process.env.AI_TIMETABLE_ENABLED !== 'true') {
      return res.status(403).json({
        error: 'AI 시간표 이미지 인식은 아직 실험 기능이라 비활성화되어 있습니다.',
      });
    }

    try {
      const { imageBase64, mimeType, defaultPeriods } = req.body;

      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: '이미지 데이터가 누락되었습니다.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: '서버에 GEMINI_API_KEY가 설정되어 있지 않습니다.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const periodContext = Array.isArray(defaultPeriods)
        ? defaultPeriods.map((p: { period: number; startTime: string; endTime: string }) => `${p.period}교시(${p.startTime}~${p.endTime})`).join(', ')
        : '1교시(09:00~09:45), 2교시(09:55~10:40), 3교시(10:50~11:35), 4교시(11:45~12:30), 5교시(13:30~14:15), 6교시(14:25~15:10), 7교시(15:20~16:05)';

      const promptText = `당신은 한국의 초·중·고등학교 가정통신문, 학급 칠판 시간표, 학원 안내문, 손글씨 시간표 이미지를 정확히 구조화하는 AI 어시스턴트입니다.
업로드된 시간표 이미지를 분석하여 요일별('월', '화', '수', '목', '금', '토', '일') 수업 및 학원 일정을 추출하세요.

[분류 및 시간 매핑 규칙]
1. 오전~오후 정규 교시(1교시~8교시 등)로 이루어진 학교 수업은 type을 "school"로 분류하고, period(교시 숫자, 예: 1, 2, 3...)와 과목명(subject)을 추출하세요.
2. 이미지에 학교 교시별 시작/종료 시간이 명시되어 있지 않다면 다음 기본 교시 시간을 자동 매핑하세요: ${periodContext}
3. 방과후 저녁 시간대나 주말의 학원/과외/특강 수업은 type을 "academy"로 분류하고, period는 0으로 두며, startTime(HH:MM)과 endTime(HH:MM), 그리고 학원/과목명(subject, 예: "수학학원", "영어학원", "과학특강")을 추출하세요. 만약 학원 종료 시간이 안 적혀 있으면 시작 시간으로부터 2시간 뒤로 설정하세요.
4. 요일은 반드시 '월', '화', '수', '목', '금', '토', '일' 중 하나로 지정하세요.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: '인식된 시간표에 대한 한 줄 요약 설명',
          },
          entries: {
            type: Type.ARRAY,
            description: '추출된 학교 및 학원 시간표 항목 목록',
            items: {
              type: Type.OBJECT,
              properties: {
                day: {
                  type: Type.STRING,
                  description: "요일 ('월', '화', '수', '목', '금', '토', '일' 중 하나)",
                },
                type: {
                  type: Type.STRING,
                  description: "'school' (학교 정규 수업) 또는 'academy' (학원/방과후 수업)",
                },
                period: {
                  type: Type.INTEGER,
                  description: '학교 수업인 경우 교시 번호(1~8), 학원 수업인 경우 0',
                },
                startTime: {
                  type: Type.STRING,
                  description: '시작 시간 (HH:MM 형식, 예: 09:00, 16:30)',
                },
                endTime: {
                  type: Type.STRING,
                  description: '종료 시간 (HH:MM 형식, 예: 09:45, 18:30)',
                },
                subject: {
                  type: Type.STRING,
                  description: '학교 과목명(예: 국어, 수학, 체육) 또는 학원명(예: 수학학원, 영어학원)',
                },
              },
              required: ['day', 'type', 'period', 'startTime', 'endTime', 'subject'],
            },
          },
        },
        required: ['summary', 'entries'],
      };

      const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
      let lastError: unknown = null;

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema,
              temperature: 0.1,
            },
          });

          const text = response.text;
          if (!text) {
            throw new Error('AI 응답이 비어 있습니다.');
          }
          const parsed = JSON.parse(text.trim());
          return res.json(parsed);
        } catch (err) {
          lastError = err;
          console.warn(`Model ${modelName} attempt failed, trying fallback if available:`, err);
        }
      }

      throw lastError || new Error('시간표 이미지 분석에 실패했습니다.');
    } catch (error: unknown) {
      console.error('AI Timetable Parse Error:', error);
      const message = error instanceof Error ? error.message : '시간표 분석 중 오류가 발생했습니다.';
      return res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
