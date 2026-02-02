import { TranscriptionResult } from "@/types";

declare const jspdf: any;

// HTML escape function to prevent HTML injection in exported documents
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const downloadTxt = (
  data: TranscriptionResult, 
  showTimestamps: boolean, 
  showSpeakers: boolean,
  speakerMap: Record<string, string>
) => {
  let content = `Transcript for: ${data.fileName}\nDate: ${new Date(data.date).toLocaleString()}\n\n`;

  data.segments.forEach((seg) => {
    let line = "";
    if (showTimestamps) {
      line += `[${formatTime(seg.timestamp)}] `;
    }
    if (showSpeakers) {
      const name = speakerMap[seg.speaker] || seg.speaker;
      line += `${name}: `;
    }
    line += `${seg.text}\n`;
    content += line;
  });

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.fileName.split('.')[0]}_transcript.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadPdf = (
  data: TranscriptionResult, 
  showTimestamps: boolean,
  showSpeakers: boolean,
  speakerMap: Record<string, string>
) => {
  const { jsPDF } = jspdf;
  const doc = new jsPDF();

  const margin = 20;
  let y = 20;
  const lineHeight = 10;
  const pageHeight = doc.internal.pageSize.height;

  doc.setFontSize(18);
  doc.text("Transcript", margin, y);
  y += lineHeight;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`File: ${data.fileName}`, margin, y);
  y += 6;
  doc.text(`Date: ${new Date(data.date).toLocaleString()}`, margin, y);
  y += lineHeight * 1.5;

  doc.setFontSize(12);
  doc.setTextColor(0);

  data.segments.forEach((seg) => {
    let prefix = "";
    if (showTimestamps) prefix += `[${formatTime(seg.timestamp)}] `;
    if (showSpeakers) {
      const name = speakerMap[seg.speaker] || seg.speaker;
      prefix += `${name}: `;
    }

    const text = `${prefix}${seg.text}`;
    const splitText = doc.splitTextToSize(text, 170);

    if (y + splitText.length * 6 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    doc.text(splitText, margin, y);
    y += splitText.length * 6 + 2;
  });

  doc.save(`${data.fileName.split('.')[0]}_transcript.pdf`);
};

export const downloadDoc = (
  data: TranscriptionResult, 
  showTimestamps: boolean,
  showSpeakers: boolean,
  speakerMap: Record<string, string>
) => {
  // Escape user-controlled data to prevent HTML injection
  const safeFileName = escapeHtml(data.fileName);
  
  const header = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${safeFileName}</title></head><body>
    <h1 style="font-family: Arial, sans-serif;">Transcript: ${safeFileName}</h1>
    <p style="color:gray; font-size: 10pt; font-family: Arial, sans-serif;">Date: ${new Date(data.date).toLocaleString()}</p>
    <br/>
  `;

  let body = "";
  data.segments.forEach(seg => {
    let line = "<p style='margin-bottom: 12px; font-family: Arial, sans-serif; line-height: 1.5;'>";
    if (showTimestamps) {
      line += `<span style='color: #666; font-size: 9pt; font-family: monospace; margin-right: 8px;'>[${formatTime(seg.timestamp)}]</span>`;
    }
    if (showSpeakers) {
      const rawName = speakerMap[seg.speaker] || seg.speaker;
      const safeName = escapeHtml(rawName);
      line += `<b style='color: #4f46e5; margin-right: 4px;'>${safeName}:</b> `;
    }
    // Escape transcription text as well for defense-in-depth
    line += `<span style='color: #111;'>${escapeHtml(seg.text)}</span></p>`;
    body += line;
  });

  const footer = "</body></html>";
  const sourceHTML = header + body + footer;

  const blob = new Blob(['\ufeff', sourceHTML], {
    type: 'application/msword'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.fileName.split('.')[0]}_transcript.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
