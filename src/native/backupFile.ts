// 데이터 내보내기: hand the backup JSON to the user.
// The Android WebView ignores <a download>, so in the app the file is written to the app's cache and
// passed to the system share sheet (KakaoTalk, Gmail, Drive, "내 파일에 저장"…). The browser downloads it.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from './androidShell';

export type BackupExportResult = 'shared' | 'downloaded' | 'cancelled';

export async function exportBackupFile(fileName: string, json: string, dialogTitle: string): Promise<BackupExportResult> {
  if (!isNativeApp) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return 'downloaded';
  }

  const written = await Filesystem.writeFile({
    path: fileName,
    data: json,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  try {
    await Share.share({ title: fileName, files: [written.uri], dialogTitle });
    return 'shared';
  } catch (e) {
    // Closing the share sheet without picking an app rejects with "Share canceled".
    if (e instanceof Error && /cancel/i.test(e.message)) return 'cancelled';
    throw e;
  }
}
