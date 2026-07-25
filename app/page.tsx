"use client";

import { useRef, useState } from "react";

const keys = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const chromatic = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
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

function transposeNote(note: string, semitones: number) {
  const aliases: Record<string, number> = { C:0, "C#":1, Db:1, D:2, "D#":3, Eb:3, E:4, F:5, "F#":6, Gb:6, G:7, "G#":8, Ab:8, A:9, "A#":10, Bb:10, B:11 };
  const index = aliases[note];
  return chromatic[(index + semitones + 12) % 12];
}

function transposeChord(chord: string, semitones: number) {
  return chord.replace(/(^|\/)([A-G](?:#|b)?)/g, (_, slash, note) => `${slash}${transposeNote(note, semitones)}`);
}

function transposeChordLine(text: string, semitones: number) {
  const parts = text.split(/(\s+|\|)/);
  let found = 0;
  const result = parts.map((part) => {
    if (chordPattern.test(part)) {
      found += 1;
      return transposeChord(part, semitones);
    }
    return part;
  }).join("");
  return { text: result, found };
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
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

  function chooseFile(selected?: File) {
    if (selected?.type === "application/pdf" || selected?.name.endsWith(".pdf")) {
      setFile(selected);
      setStatus("idle");
    }
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
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        setStep(Math.min(3, Math.ceil((pageNumber / document.numPages) * 3)));
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        for (const item of content.items) {
          if ("str" in item) count += transposeChordLine(item.str, 0).found;
        }
      }
      setDetectedCount(count);
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
      const from = chromatic.indexOf(normalizeKey(originalKey));
      const to = chromatic.indexOf(normalizeKey(key));
      const semitones = (to - from + 12) % 12;
      let replacements = 0;

      for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
        const sourcePage = await source.getPage(pageNumber);
        const content = await sourcePage.getTextContent();
        const targetPage = output.getPage(pageNumber - 1);
        for (const rawItem of content.items) {
          if (!("str" in rawItem) || !("transform" in rawItem)) continue;
          const changed = transposeChordLine(rawItem.str, semitones);
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
      tabPage.drawText("Use as frases nas transicoes entre secoes. Ajuste o ritmo ao groove da musica.", { x: 48, y: 738, size: 9, font: bold, color: rgb(0.35, 0.4, 0.36) });
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
        const top = 680 - index * 175;
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
            <div><span className="success">✓ CIFRAS RECONHECIDAS</span><h2>Seu novo PDF está pronto.</h2><p>De {originalKey} para {key} · Tablatura E–A–D–G · {bass}% de detalhes</p></div>
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
        <div><span>Leitura musical</span><span>Transposição precisa</span><span>Contrabaixo inteligente</span><span>Exportação editável</span></div>
      </section>

      <footer><a className="brand" href="#"><span className="brandMark">𝄞</span><span>CLAVE</span></a><p>A essência permanece. O arranjo evolui.</p><small>Protótipo experimental · 2026</small></footer>
    </main>
  );
}
