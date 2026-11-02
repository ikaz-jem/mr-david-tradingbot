import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function saveAccountExport(data: unknown) {
  const file = new File(Paths.cache, `enrivea-export-${Date.now()}.json`);
  await file.write(JSON.stringify(data, null, 2));
  if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export Enrivea account data' });
}
