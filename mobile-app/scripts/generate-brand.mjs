import sharp from 'sharp';
import { join } from 'node:path';

const output = join(import.meta.dirname, '..', 'assets', 'images');
const mark = `<path d="M355 690 512 272l157 418h-76l-34-94h-94l26-70h43l-22-66-82 230z" fill="#C5FF43"/><path d="M380 727h264" stroke="#C5FF43" stroke-width="24" stroke-linecap="round"/>`;
const canvas = (content, background = '#07100B') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="225" fill="${background}"/><circle cx="512" cy="500" r="323" fill="#102113" stroke="#3A5E27" stroke-width="3"/><circle cx="512" cy="500" r="277" fill="none" stroke="#244329" stroke-width="2"/><path d="M235 500h555M512 224v552" stroke="#244329" stroke-width="2" opacity=".6"/>${content}</svg>`);
await sharp(canvas(mark)).png().toFile(join(output, 'icon.png'));
await sharp(canvas(mark)).png().toFile(join(output, 'android-icon-foreground.png'));
await sharp(canvas(mark, '#07100B')).png().toFile(join(output, 'android-icon-background.png'));
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${mark.replaceAll('#C5FF43', '#FFFFFF')}</svg>`)).png().toFile(join(output, 'android-icon-monochrome.png'));
await sharp(canvas(mark)).png().toFile(join(output, 'splash-icon.png'));
await sharp(canvas(mark)).resize(64, 64).png().toFile(join(output, 'favicon.png'));
