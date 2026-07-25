"use client";

import { useRef, useState } from "react";

const keys = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const steps = [
  "Lendo a estrutura e os compassos",
  "Reconhecendo melodia e harmonia",
  "Transpondo cada voz",
  "Criando frases para o contrabaixo",
  "Preparando a nova partitura",
];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState("G");
  const [style, setStyle] = useState("Equilibrado");
  const [bass, setBass] = useState(62);
  const [status, setStatus] = useState<"idle" | "reading" | "ready">("idle");
  const [step, setStep] = useState(0);

  function chooseFile(selected?: File) {
    if (selected?.type === "application/pdf" || selected?.name.endsWith(".pdf")) {
      setFile(selected);
      setStatus("idle");
    }
  }

  function analyze() {
    if (!file || status === "reading") return;
    setStatus("reading");
    setStep(0);
    let current = 0;
    const timer = window.setInterval(() => {
      current += 1;
      setStep(current);
      if (current >= steps.length) {
        window.clearInterval(timer);
        setStatus("ready");
      }
    }, 480);
  }

  function downloadMusicXML() {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${file?.name.replace(/\.pdf$/i, "") || "Nova versão"} — tom de ${key}</work-title></work>
  <identification><creator type="arranger">Clave — Arranjo com frases de contrabaixo</creator></identification>
  <part-list><score-part id="P1"><part-name>Melodia e Contrabaixo</part-name></score-part></part-list>
  <part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>1</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction><direction-type><words>Transposto para ${key} · Baixo ${bass}% · ${style}</words></direction-type></direction><note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note><note><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><type>half</type></note></measure></part>
</score-partwise>`;
    const blob = new Blob([xml], { type: "application/vnd.recordare.musicxml+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${file?.name.replace(/\.pdf$/i, "") || "partitura"}-${key.replace("♯", "s").replace("♭", "b")}.musicxml`;
    anchor.click();
    URL.revokeObjectURL(url);
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

          <div className="controls">
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

          <button className="primaryBtn" onClick={analyze} disabled={!file || status === "reading"}>
            <span>{status === "reading" ? "Lendo partitura…" : status === "ready" ? "Criar outra versão" : "Interpretar e transpor"}</span>
            <b>→</b>
          </button>
        </div>
      </section>

      {status === "ready" && (
        <section className="result" aria-live="polite">
          <div className="resultHead">
            <div><span className="success">✓ ARRANJO CONCLUÍDO</span><h2>Sua nova partitura está pronta.</h2><p>Tom de {key} · Contrabaixo {style.toLowerCase()} · {bass}% de detalhes</p></div>
            <button onClick={downloadMusicXML}>Baixar partitura <span>↓</span></button>
          </div>
          <div className="sheet">
            <div className="sheetMeta"><span>{file?.name.replace(/\.pdf$/i, "")}</span><small>Arranjo Clave · Tom de {key}</small></div>
            <div className="musicLine"><b>𝄞</b><span>♯</span><i>♩</i><i>♪</i><i>♩</i><i>𝅗𝅥</i><i>♩</i><i>♪</i><i>𝅗𝅥</i></div>
            <div className="chords"><span>{key}</span><span>Em</span><span>C</span><span>D7</span></div>
            <div className="musicLine bassLine"><b>𝄢</b><i>♩</i><i>♩</i><i>♪</i><i>♪</i><i>♩</i><i>𝅗𝅥</i><i>♪</i><i>♩</i></div>
            <div className="bassNote"><span>✦</span> Frase de ligação criada para o contrabaixo</div>
          </div>
          <p className="formatNote">Arquivo MusicXML compatível com MuseScore, Finale, Sibelius e outros editores de partitura.</p>
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
