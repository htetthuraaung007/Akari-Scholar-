import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  PageBreak, 
  Header, 
  PageNumber 
} from 'docx';
import { saveAs } from 'file-saver';

// APA 7th Assignment Activity DOCX Generator (Zero-API Key, Pure Client-side)
export const exportAssignmentActivityDocx = async (data: {
  title: string;
  institution: string;
  courseCode: string;
  instructorName: string;
  studentName: string;
  submissionDate: string;
  bodyContent: string;
  referencesContent?: string;
}) => {
  // 1. Parsing Body Lines & References
  const rawBody = data.bodyContent || '';
  const lines = rawBody.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let referencesIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^references\b/i.test(lines[i])) {
      referencesIndex = i;
      break;
    }
  }

  const mainBodyLines = referencesIndex !== -1 ? lines.slice(0, referencesIndex) : lines;
  const rawRefLines = referencesIndex !== -1 
    ? lines.slice(referencesIndex + 1) 
    : (data.referencesContent ? data.referencesContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : []);

  // 2. Count Words (Body text only, excluding headings and cover info)
  let wordCount = 0;
  mainBodyLines.forEach((line) => {
    const isHeading = line.startsWith('#') || (line.length < 75 && !line.endsWith('.') && !line.includes('('));
    if (!isHeading) {
      wordCount += line.split(/\s+/).filter(Boolean).length;
    }
  });

  const docParagraphs: Paragraph[] = [];

  // ==========================================
  // PAGE 1: APA 7th STUDENT TITLE PAGE (CENTERED)
  // ==========================================
  // Blank top spacing (3 double spaces down)
  for (let i = 0; i < 3; i++) {
    docParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 480, before: 0, after: 0 },
        children: [new TextRun({ text: '', font: 'Times New Roman', size: 24 })],
      })
    );
  }

  // Paper Title (Bold, Centered)
  docParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 480, before: 0, after: 0 },
      children: [
        new TextRun({
          text: data.title || 'Assignment Activity',
          bold: true,
          font: 'Times New Roman',
          size: 24, // 12pt
        }),
      ],
    })
  );

  // Extra line break under title as per APA 7th
  docParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 480, before: 0, after: 0 },
      children: [new TextRun({ text: '', font: 'Times New Roman', size: 24 })],
    })
  );

  // Institutional Metadata (Centered, Regular text, Double-spaced)
  const metaLines = [
    data.institution || 'University of the People',
    data.courseCode || 'POLS 1503-01 AY2027-T1',
    data.instructorName ? `Instructor: ${data.instructorName}` : 'Instructor: Innocent Ndock Kong',
    data.studentName || 'Thin Yati Aung',
    data.submissionDate || 'September 22, 2026',
  ];

  metaLines.forEach((meta) => {
    docParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 480, before: 0, after: 0 },
        children: [
          new TextRun({
            text: meta,
            font: 'Times New Roman',
            size: 24,
          }),
        ],
      })
    );
  });

  // PAGE BREAK AFTER TITLE PAGE
  docParagraphs.push(
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  // ==========================================
  // PAGE 2+: BODY CONTENT (DOUBLE SPACED, 0.5" INDENT)
  // ==========================================
  // Repeat Paper Title at top of Page 2 (APA 7th rule, Bold, Centered)
  docParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 480, before: 0, after: 0 },
      children: [
        new TextRun({
          text: data.title || 'Assignment Activity',
          bold: true,
          font: 'Times New Roman',
          size: 24,
        }),
      ],
    })
  );

  // Render Body Paragraphs & Subheadings
  mainBodyLines.forEach((line) => {
    const isHeading = line.startsWith('#') || (line.length < 80 && !line.endsWith('.') && !line.includes('(') && !line.toLowerCase().startsWith('word count'));
    const cleanLine = line.replace(/^#+\s*/, '').trim();

    if (isHeading) {
      // Subheading: Level 2/3 (Bold, Left-Aligned, NO INDENT, Double-Spaced)
      docParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: 480, before: 0, after: 0 },
          children: [
            new TextRun({
              text: cleanLine,
              bold: true,
              font: 'Times New Roman',
              size: 24,
            }),
          ],
        })
      );
    } else {
      // Normal Paragraph: First-Line Indent 0.5 inch (720 twips), Double-Spaced
      docParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { firstLine: 720 }, // 0.5" indent
          spacing: { line: 480, before: 0, after: 0 },
          children: [
            new TextRun({
              text: line,
              font: 'Times New Roman',
              size: 24,
            }),
          ],
        })
      );
    }
  });

  // Word Count indicator under body
  docParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: 480, before: 240, after: 0 },
      children: [
        new TextRun({
          text: `Word count: ${wordCount} (not including titles & references)`,
          italics: true,
          font: 'Times New Roman',
          size: 24,
        }),
      ],
    })
  );

  // ==========================================
  // PAGE 3+: REFERENCES (SEPARATE PAGE, HANGING INDENT)
  // ==========================================
  if (rawRefLines.length > 0) {
    // Break to dedicated References page
    docParagraphs.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    // References Title: Bold, Centered
    docParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 480, before: 0, after: 0 },
        children: [
          new TextRun({
            text: 'References',
            bold: true,
            font: 'Times New Roman',
            size: 24,
          }),
        ],
      })
    );

    // Each Reference: 0.5" Hanging Indent (left: 720, hanging: 720), Double-Spaced
    rawRefLines.forEach((ref) => {
      docParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { left: 720, hanging: 720 }, // Hanging Indent 0.5 inch
          spacing: { line: 480, before: 0, after: 0 },
          children: [
            new TextRun({
              text: ref,
              font: 'Times New Roman',
              size: 24,
            }),
          ],
        })
      );
    });
  }

  // 3. Assemble Full DOCX Document with Top-Right Page Numbers
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch
              bottom: 1440, // 1 inch
              left: 1440,   // 1 inch
              right: 1440,  // 1 inch
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: 'Times New Roman',
                    size: 24, // 12pt
                  }),
                ],
              }),
            ],
          }),
        },
        children: docParagraphs,
      },
    ],
  });

  // 4. Generate Blob & Trigger Instant Download
  const blob = await Packer.toBlob(doc);
  const cleanFileName = (data.title || 'Assignment_Activity_APA7')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .concat('.docx');
  saveAs(blob, cleanFileName);
};
