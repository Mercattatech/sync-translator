# Clave — Inteligência Musical

Aplicação web para interpretar cifras em PDFs, transpor a harmonia para outra
tonalidade e exportar um novo PDF com sugestões de frases em tablatura para
contrabaixo de quatro cordas (E–A–D–G).

## Recursos

- upload de PDF por clique ou arrastar;
- escolha do tom atual e do tom desejado;
- identificação e transposição de cifras em texto selecionável;
- preservação das páginas do documento original;
- exportação em PDF com tablaturas de contrabaixo;
- interface responsiva em português.

## Desenvolvimento

Requer Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Para validar a versão de produção:

```bash
npm run build
```

## Limitação atual

PDFs escaneados ou com cifras convertidas em imagens/vetores exigem um módulo
adicional de OCR musical.
