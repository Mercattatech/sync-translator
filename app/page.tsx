"use client";

import { useRef, useState } from "react";

const keys = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const chromatic = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const noteValues: Record<string, number> = { C:0, "C#":1, Db:1, D:2, "D#":3, Eb:3, E:4, F:5, "F#":6, Gb:6, G:7, "G#":8, Ab:8, A:9, "A#":10, Bb:10, B:11 };
const nashvilleDegrees = ["1", "♭2", "2", "♭3", "3", "4", "♯4", "5", "♭6", "6", "♭7", "7"];
const majorScale = [0, 2, 4, 5, 7, 9, 11];
const nashvilleTokenPattern = /^([♭b♯#]?)([1-7])([^/\s|]*)(?:\/([♭b♯#]?)([1-7]))?$/;
const chordPattern = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?(?:2|4|5|6|7|9|11|13)?(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/;
const steps = [
  "Lendo textos e posições do PDF",
  "Reconhecendo as cifras",
  "Calculando a nova tonalidade",
  "Escrevendo a tablatura de 4 cordas",
  "Preparando o PDF original",
];

function normalizeKey(value: string) {
  return value.replace("♯", "#").replace("♭", "b");
}

function parseChord(chord: string) {
  const match = chord.match(/^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/);
  return match ? { root: match[1], quality: match[2], bass: match[3] || "" } : null;
}

function degreeForNote(note: string, tonic: string) {
  return nashvilleDegrees[(noteValues[note] - noteValues[normalizeKey(tonic)] + 12) % 12];
}

function chordToNashville(chord: string, tonic: string) {
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  const bass = parsed.bass ? `/${degreeForNote(parsed.bass, tonic)}` : "";
  return `${degreeForNote(parsed.root, tonic)}${parsed.quality}${bass}`;
}

function chordFromNashville(chord: string, sourceKey: string, targetKey: string) {
  const parsed = parseChord(chord);
  if (!parsed) return chord;
  const sourceTonic = noteValues[normalizeKey(sourceKey)];
  const targetTonic = noteValues[normalizeKey(targetKey)];
  const rootDegree = (noteValues[parsed.root] - sourceTonic + 12) % 12;
  const root = chromatic[(targetTonic + rootDegree) % 12];
  const bass = parsed.bass
    ? `/${chromatic[(targetTonic + noteValues[parsed.bass] - sourceTonic + 12) % 12]}`
    : "";
  return `${root}${parsed.quality}${bass}`;
}

function noteFromDegree(accidental: string, degree: string, targetKey: string) {
  const alteration = accidental === "♭" || accidental === "b" ? -1 : accidental === "♯" || accidental === "#" ? 1 : 0;
  const tonic = noteValues[normalizeKey(targetKey)];
  return chromatic[(tonic + majorScale[Number(degree) - 1] + alteration + 12) % 12];
}

function nashvilleTokenToChord(token: string, targetKey: string) {
  const match = token.match(nashvilleTokenPattern);
  if (!match) return token;
  if (/^x$/i.test(match[3])) return token;
  const root = noteFromDegree(match[1], match[2], targetKey);
  const quality = match[3] || "";
  const bass = match[5] ? `/${noteFromDegree(match[4], match[5], targetKey)}` : "";
  return `${root}${quality}${bass}`;
}

function convertNashvilleText(text: string, targetKey: string) {
  return text
    .split(/(\s+|\|)/)
    .map((part) => nashvilleTokenToChord(part, targetKey))
    .join("");
}

function textContentToLayout(items: Array<{ str: string; transform: number[]; width?: number }>) {
  const rows: Array<{ y: number; items: Array<{ str: string; x: number; width: number }> }> = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ str: item.str, x, width: item.width || item.str.length * 6 });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const parts = row.items.sort((a, b) => a.x - b.x);
      let line = "";
      let lastEnd = parts[0]?.x || 0;
      for (const part of parts) {
        const gap = part.x - lastEnd;
        if (line) line += " ".repeat(Math.max(1, Math.min(12, Math.round(gap / 5))));
        line += part.str;
        lastEnd = part.x + part.width;
      }
      return line.trimEnd();
    })
    .join("\n");
}

function transposeChordLine(text: string, sourceKey: string, targetKey: string) {
  const parts = text.split(/(\s+|\|)/);
  let found = 0;
  const result = parts.map((part) => {
    if (chordPattern.test(part)) {
      found += 1;
      return chordFromNashville(part, sourceKey, targetKey);
    }
    return part;
  }).join("");
  return { text: result, found };
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const nashvilleFileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [originalKey, setOriginalKey] = useState("C");
  const [key, setKey] = useState("G");
  const [style, setStyle] = useState("Equilibrado");
  const [bass, setBass] = useState(62);
  const [status, setStatus] = useState<"idle" | "reading" | "ready">("idle");
  const [step, setStep] = useState(0);
  const [detectedCount, setDetectedCount] = useState(0);
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [detectedChords, setDetectedChords] = useState<string[]>([]);
  const [nashvilleInput, setNashvilleInput] = useState("1 | 6m | 4 | 5\n1/3 | 4maj7 | 2m7 | 5sus4");
  const [nashvilleResult, setNashvilleResult] = useState("");
  const [nashvilleNotice, setNashvilleNotice] = useState("");
  const nashvillePreview = detectedChords.map((chord) => chordToNashville(chord, originalKey));

  function chooseFile(selected?: File) {
    if (selected?.type === "application/pdf" || selected?.name.endsWith(".pdf")) {
      setFile(selected);
      setStatus("idle");
    }
  }

  async function chooseNashvilleFile(selected?: File) {
    if (!selected) return;
    let text = "";
    if (selected.type === "application/pdf" || selected.name.toLowerCase().endsWith(".pdf")) {
      setNashvilleNotice("Lendo o PDF Nashville…");
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const document = await pdfjs.getDocument({ data: new Uint8Array(await selected.arrayBuffer()) }).promise;
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const items = content.items
          .filter((item): item is typeof item & { str: string; transform: number[]; width?: number } => "str" in item && "transform" in item)
          .map((item) => ({ str: item.str, transform: item.transform, width: item.width }));
        pages.push(textContentToLayout(items));
      }
      text = pages.join("\n\n");
    } else {
      text = await selected.text();
    }
    setNashvilleInput(text);
    setNashvilleResult("");
    setNashvilleNotice(`${selected.name} carregado. A letra e a estrutura foram preservadas; escolha o tom e converta.`);
  }

  function convertNashville() {
    if (!nashvilleInput.trim()) return;
    setNashvilleResult(convertNashvilleText(nashvilleInput, key));
    setNashvilleNotice(`Cifra Nashville convertida corretamente para o tom de ${key}.`);
  }

  async function copyNashvilleResult() {
    await navigator.clipboard.writeText(nashvilleResult);
    setNashvilleNotice("Cifra copiada.");
  }

  async function downloadNashvillePDF() {
    if (!nashvilleResult) return;
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const mono = await pdf.embedFont(StandardFonts.CourierBold);
    const lines = nashvilleResult.split("\n").flatMap((line) => {
      if (line.length <= 68) return [line];
      const chunks: string[] = [];
      for (let index = 0; index < line.length; index += 68) chunks.push(line.slice(index, index + 68));
      return chunks;
    });
    let page = pdf.addPage([595.28, 841.89]);
    let y = 720;
    const drawHeader = () => {
      page.drawText("CLAVE — CIFRA CONVERTIDA", { x: 48, y: 790, size: 18, font: bold, color: rgb(0.08, 0.16, 0.13) });
      page.drawText(`Sistema Nashville convertido para o tom de ${normalizeKey(key)}`, { x: 48, y: 762, size: 10, font: bold, color: rgb(0.9, 0.37, 0.18) });
    };
    drawHeader();
    lines.forEach((line) => {
      if (y < 65) {
        page = pdf.addPage([595.28, 841.89]);
        y = 720;
        drawHeader();
      }
      page.drawText(line || " ", { x: 48, y, size: 10, font: mono, color: rgb(0.08, 0.16, 0.13) });
      y -= 18;
    });
    const bytes = await pdf.save();
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cifra-nashville-tom-${key.replace("♯", "s").replace("♭", "b")}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setNashvilleNotice("Download do PDF iniciado.");
  }

  async function analyze() {
    if (!file || status === "reading") return;
    setStatus("reading");
    setStep(0);
    setNotice("");
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const document = await pdfjs.getDocument({ data: bytes }).promise;
      let count = 0;
      const chords: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        setStep(Math.min(3, Math.ceil((pageNumber / document.numPages) * 3)));
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        for (const item of content.items) {
          if (!("str" in item)) continue;
          count += transposeChordLine(item.str, originalKey, key).found;
          item.str.split(/(\s+|\|)/).forEach((part) => {
            if (chordPattern.test(part) && chords.length < 20) chords.push(part);
          });
        }
      }
      setDetectedCount(count);
      setDetectedChords(chords);
      setStep(5);
      setStatus("ready");
      setNotice(count ? `${count} cifra${count === 1 ? "" : "s"} reconhecida${count === 1 ? "" : "s"} no PDF.` : "Não encontrei cifras em texto. O arquivo pode ser escaneado ou usar símbolos vetoriais.");
    } catch {
      setStatus("idle");
      setNotice("Não consegui ler este PDF. Tente um arquivo sem senha e com texto selecionável.");
    }
  }

  async function downloadPDF() {
    if (!file || exporting) return;
    setExporting(true);
    setNotice("Gerando o novo PDF…");
    try {
      const [{ PDFDocument, StandardFonts, rgb }, pdfjs] = await Promise.all([
      import("pdf-lib"),
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      ]);
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const originalBytes = new Uint8Array(await file.arrayBuffer());
      const source = await pdfjs.getDocument({ data: originalBytes.slice() }).promise;
      const output = await PDFDocument.load(originalBytes);
      const bold = await output.embedFont(StandardFonts.HelveticaBold);
      const mono = await output.embedFont(StandardFonts.CourierBold);
      const to = chromatic.indexOf(normalizeKey(key));
      let replacements = 0;

      for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
        const sourcePage = await source.getPage(pageNumber);
        const content = await sourcePage.getTextContent();
        const targetPage = output.getPage(pageNumber - 1);
        for (const rawItem of content.items) {
          if (!("str" in rawItem) || !("transform" in rawItem)) continue;
          const changed = transposeChordLine(rawItem.str, originalKey, key);
          if (!changed.found || changed.text === rawItem.str) continue;
          const x = rawItem.transform[4];
          const y = rawItem.transform[5];
          const size = Math.max(7, Math.min(18, Math.abs(rawItem.height || rawItem.transform[3]) || 10));
          const width = Math.max(rawItem.width || bold.widthOfTextAtSize(rawItem.str, size), bold.widthOfTextAtSize(changed.text, size)) + 3;
          targetPage.drawRectangle({ x: x - 1, y: y - 2, width, height: size + 5, color: rgb(1, 1, 1) });
          targetPage.drawText(changed.text, { x, y, size, font: bold, color: rgb(0.08, 0.16, 0.13) });
          replacements += changed.found;
        }
      }

      const tabPage = output.addPage([595.28, 841.89]);
      tabPage.drawText("CLAVE — FRASES DE CONTRABAIXO", { x: 48, y: 786, size: 17, font: bold, color: rgb(0.08, 0.16, 0.13) });
      tabPage.drawText(`Tom: ${normalizeKey(key)}   |   Baixo de 4 cordas: E-A-D-G   |   Estilo: ${style}`, { x: 48, y: 760, size: 10, font: bold });
      tabPage.drawText(`Nashville: ${nashvillePreview.map((item) => item.replace("♭", "b").replace("♯", "#")).join(" | ").slice(0, 72)}`, { x: 48, y: 738, size: 9, font: bold, color: rgb(0.9, 0.37, 0.18) });
      tabPage.drawText("Use as frases nas transicoes entre secoes. Ajuste o ritmo ao groove da musica.", { x: 48, y: 718, size: 9, font: bold, color: rgb(0.35, 0.4, 0.36) });
      const tonic = to;
      const fifth = (tonic + 7) % 12;
      const octaveFret = (tonic - 4 + 12) % 12;
      const fifthFret = (fifth - 9 + 12) % 12;
      const phrases = [
      ["FRASE 1 — entrada / verso", `G|----------------|`, `D|------------${String(fifthFret).padStart(2, "-")}-|`, `A|------${String(fifthFret).padStart(2, "-")}--------|`, `E|-${String(octaveFret).padStart(2, "-")}--${String(octaveFret + 2).padStart(2, "-")}-----------|`],
      ["FRASE 2 — ligacao para o refrao", `G|-------------${String((tonic - 7 + 12) % 12).padStart(2, "-")}-|`, `D|------${String(fifthFret).padStart(2, "-")}--${String(fifthFret + 2).padStart(2, "-")}----|`, `A|-${String(fifthFret).padStart(2, "-")}--------------|`, `E|----------------|`],
      ["FRASE 3 — final de secao", `G|----------------|`, `D|-${String(fifthFret).padStart(2, "-")}--${String(fifthFret + 2).padStart(2, "-")}--${String(fifthFret + 4).padStart(2, "-")}-----|`, `A|-------------${String(fifthFret).padStart(2, "-")}-|`, `E|----------------|`],
      ];
      phrases.forEach((phrase, index) => {
        const top = 665 - index * 175;
        phrase.forEach((line, lineIndex) => tabPage.drawText(line, { x: 60, y: top - lineIndex * 24, size: lineIndex ? 13 : 11, font: lineIndex ? mono : bold, color: lineIndex ? rgb(0.08, 0.16, 0.13) : rgb(0.9, 0.37, 0.18) }));
      });
      tabPage.drawText("Tablatura sugerida: valide digitacao, tessitura e contexto harmonico antes da apresentacao.", { x: 48, y: 80, size: 8, font: bold, color: rgb(0.4, 0.43, 0.4) });

      const pdfBytes = await output.save();
      const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${file.name.replace(/\.pdf$/i, "")}-${key.replace("♯", "s").replace("♭", "b")}-com-baixo.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setNotice(`Download iniciado: ${replacements} cifra${replacements === 1 ? "" : "s"} transposta${replacements === 1 ? "" : "s"} e uma página de tablaturas.`);
    } catch (error) {
      console.error(error);
      setNotice("Não foi possível gerar o download deste PDF. Verifique se o arquivo não está protegido por senha e tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Clave, início">
          <span className="brandMark">𝄞</span>
          <span>CLAVE</span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#estudio">Estúdio</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#recursos">Recursos</a>
        </nav>
        <button className="historyBtn" type="button">Meus arranjos <span>↗</span></button>
      </header>

      <section className="hero" id="estudio">
        <div className="eyebrow"><span>✦</span> INTELIGÊNCIA MUSICAL</div>
        <h1>Sua música, em <em>qualquer tom.</em><br />Mais rica, nota por nota.</h1>
        <p className="lead">Envie uma partitura em PDF. A Clave interpreta, transpõe e cria frases de contrabaixo que valorizam o arranjo — sem perder a essência.</p>

        <div className="studioCard">
          <div className="staff staffTop" aria-hidden="true"><span>𝄞</span><i></i><b>♩</b><b>♪</b><b>𝅗𝅥</b></div>
          <div className="nashvilleConverter">
            <div className="converterHead">
              <div><span>CONVERSOR NASHVILLE</span><strong>Dos números para a cifra.</strong></div>
              <button type="button" onClick={() => nashvilleFileRef.current?.click()}>↑ Subir PDF Nashville</button>
              <input ref={nashvilleFileRef} type="file" accept=".pdf,.txt,.nns,application/pdf,text/plain" onChange={(event) => chooseNashvilleFile(event.target.files?.[0])} />
            </div>
            <label>
              <span>PDF, TEXTO OU CIFRA NASHVILLE</span>
              <textarea value={nashvilleInput} onChange={(event) => { setNashvilleInput(event.target.value); setNashvilleResult(""); }} placeholder="Ex.: 1 | 6m | 4 | 5&#10;1/3 | 4maj7 | 2m7 | 5sus4" />
            </label>
            <div className="converterActions">
              <label>
                <span>CONVERTER PARA O TOM</span>
                <select value={key} onChange={(event) => { setKey(event.target.value); setNashvilleResult(""); }}>
                  {keys.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <button type="button" onClick={convertNashville} disabled={!nashvilleInput.trim()}>Converter em cifras <b>→</b></button>
            </div>
            {nashvilleResult && (
              <div className="convertedChart" aria-live="polite">
                <span>CIFRA NO TOM DE {key}</span>
                <pre>{nashvilleResult}</pre>
                <div><button type="button" onClick={copyNashvilleResult}>Copiar cifra</button><button type="button" onClick={downloadNashvillePDF}>Baixar PDF</button></div>
              </div>
            )}
            {nashvilleNotice && <small className="converterNotice">{nashvilleNotice}</small>}
          </div>
          <div className="orDivider"><span>OU TRANSPONHA UM PDF CIFRADO</span></div>
          <div
            className={`dropzone ${file ? "hasFile" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => event.key === "Enter" && inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" onChange={(event) => chooseFile(event.target.files?.[0])} />
            <span className="uploadIcon">{file ? "✓" : "↑"}</span>
            <div>
              <strong>{file ? file.name : "Solte sua partitura aqui"}</strong>
              <small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · PDF pronto para leitura` : "ou clique para escolher um arquivo PDF"}</small>
            </div>
            <span className="pdfPill">PDF</span>
          </div>

          <div className="controls fourControls">
            <label>
              <span>TOM ATUAL</span>
              <select value={originalKey} onChange={(event) => setOriginalKey(event.target.value)}>
                {keys.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>TRANSPOR PARA</span>
              <select value={key} onChange={(event) => setKey(event.target.value)}>
                {keys.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>PERSONALIDADE DO ARRANJO</span>
              <select value={style} onChange={(event) => setStyle(event.target.value)}>
                <option>Equilibrado</option><option>Elegante</option><option>Groove</option><option>Minimalista</option>
              </select>
            </label>
            <label className="rangeLabel">
              <span>DETALHE DO CONTRABAIXO <output>{bass}%</output></span>
              <input type="range" min="20" max="100" value={bass} onChange={(event) => setBass(Number(event.target.value))} />
              <small><i>Essencial</i><i>Expressivo</i></small>
            </label>
          </div>

          {status === "reading" && (
            <div className="progressBox" aria-live="polite">
              <div><span className="pulse">◉</span><strong>{steps[Math.min(step, steps.length - 1)]}</strong><b>{Math.min(96, 12 + step * 21)}%</b></div>
              <div className="progress"><i style={{ width: `${Math.min(96, 12 + step * 21)}%` }} /></div>
            </div>
          )}
          {notice && <p className={`notice ${detectedCount ? "ok" : ""}`}>{notice}</p>}
          {status === "ready" && nashvillePreview.length > 0 && (
            <div className="nashvilleBox">
              <span>SISTEMA NASHVILLE · TOM {originalKey}</span>
              <div>{nashvillePreview.map((item, index) => <b key={`${item}-${index}`}>{item}</b>)}</div>
              <small>Os graus são reconstruídos automaticamente no tom de {key}.</small>
            </div>
          )}

          <button className="primaryBtn" onClick={status === "ready" ? downloadPDF : analyze} disabled={!file || status === "reading" || exporting}>
            <span>{exporting ? "Gerando o PDF…" : status === "reading" ? "Lendo partitura…" : status === "ready" ? "Baixar PDF com tablatura" : "Interpretar e transpor"}</span>
            <b>{status === "ready" ? "↓" : "→"}</b>
          </button>
          {status === "ready" && <button className="resetBtn" type="button" onClick={() => { setStatus("idle"); setNotice(""); }}>Alterar tom ou criar outra versão</button>}
        </div>
      </section>

      {status === "ready" && (
        <section className="result" aria-live="polite">
          <div className="resultHead">
            <div><span className="success">✓ TRANSPOSIÇÃO NASHVILLE</span><h2>Seu novo PDF está pronto.</h2><p>De {originalKey} para {key} · Graus Nashville · Tablatura E–A–D–G</p></div>
            <button onClick={downloadPDF} disabled={exporting}>{exporting ? "Gerando PDF…" : "Baixar PDF com tablatura"} <span>↓</span></button>
          </div>
          <div className="sheet">
            <div className="sheetMeta"><span>{file?.name.replace(/\.pdf$/i, "")}</span><small>Arranjo Clave · Tom de {key}</small></div>
            <div className="musicLine"><b>𝄞</b><span>♯</span><i>♩</i><i>♪</i><i>♩</i><i>𝅗𝅥</i><i>♩</i><i>♪</i><i>𝅗𝅥</i></div>
            <div className="chords"><span>{key}</span><span>Em</span><span>C</span><span>D7</span></div>
            <div className="musicLine bassLine"><b>𝄢</b><i>♩</i><i>♩</i><i>♪</i><i>♪</i><i>♩</i><i>𝅗𝅥</i><i>♪</i><i>♩</i></div>
            <div className="bassNote"><span>✦</span> Frase de ligação criada para o contrabaixo</div>
          </div>
          <p className="formatNote">Mantém as páginas originais, substitui cifras reconhecidas e adiciona uma página de tablaturas para baixo de 4 cordas.</p>
        </section>
      )}

      <section className="how" id="como-funciona">
        <div><span>01</span><strong>Você envia</strong><p>Uma partitura em PDF, seja cifra, lead sheet ou partitura completa.</p></div>
        <div><span>02</span><strong>A Clave entende</strong><p>Melodia, acordes, ritmo, forma e a função de cada instrumento.</p></div>
        <div><span>03</span><strong>Você recebe</strong><p>Uma versão no novo tom, enriquecida e pronta para tocar.</p></div>
      </section>

      <section className="features" id="recursos">
        <p>FEITO PARA QUEM OUVE ALÉM DAS NOTAS</p>
        <div><span>Leitura musical</span><span>Sistema Nashville</span><span>Contrabaixo inteligente</span><span>Exportação em PDF</span></div>
      </section>

      <footer><a className="brand" href="#"><span className="brandMark">𝄞</span><span>CLAVE</span></a><p>A essência permanece. O arranjo evolui.</p><small>Protótipo experimental · 2026</small></footer>
    </main>
  );
}
