import { useEffect, useRef, useState } from 'react';
import { currentLocale } from '../i18n/runtime';
import type { Locale } from '../i18n/runtime';
import type { Mode } from '../types';

type Info = { title: string; role: string; facts: string[] };

const UI: Record<Locale, { button: string; short: string; close: string; sources: string }> = {
  en: { button: 'How this election works', short: 'How it works', close: 'Close election information', sources: 'Sources' },
  es: { button: 'Cómo funciona esta elección', short: 'Cómo funciona', close: 'Cerrar información electoral', sources: 'Fuentes' },
  fr: { button: 'Comment fonctionne cette élection', short: 'Comment ça marche', close: 'Fermer les informations électorales', sources: 'Sources' },
  de: { button: 'So funktioniert diese Wahl', short: 'So funktioniert’s', close: 'Wahlinformationen schließen', sources: 'Quellen' },
  'pt-BR': { button: 'Como funciona esta eleição', short: 'Como funciona', close: 'Fechar informações eleitorais', sources: 'Fontes' },
};

const INFO: Record<Locale, Record<Mode, Info>> = {
  en: {
    president: {
      title: 'Presidential elections',
      role: 'The president leads the federal executive branch, enforces federal laws, directs foreign policy, and is commander in chief of the armed forces.',
      facts: [
        'The president serves a four-year term. Voters choose electors, who then vote for president through the Electoral College.',
        'There are 538 electoral votes; 270 are needed to win.',
        'There is no presidential election in 2026. This map starts with the 2024 results; the next presidential election is in 2028.',
      ],
    },
    senate: {
      title: 'U.S. Senate elections',
      role: 'Senators represent their states in Congress. They write and vote on federal laws, confirm many presidential nominees, approve treaties, and hold impeachment trials.',
      facts: [
        'The Senate has 100 seats: two senators from each state.',
        'Senators serve six-year terms. About one-third of the seats are elected every two years.',
        'This 2026 map covers 35 Senate elections: 33 regular races and special elections in Florida and Ohio.',
      ],
    },
    house: {
      title: 'U.S. House elections',
      role: 'Representatives serve people in congressional districts. They write and vote on federal laws, serve on committees, introduce revenue bills, and can impeach federal officials.',
      facts: [
        'The House has 435 voting seats, divided among states based on population.',
        'Representatives serve two-year terms. All 435 seats are up for election every even-numbered year.',
        'A party needs 218 of the 435 voting seats for a majority.',
      ],
    },
    governor: {
      title: 'Governor elections',
      role: 'A governor leads a state’s executive branch. Governors carry out state laws, sign or veto state bills, appoint officials, and manage state emergencies.',
      facts: [
        'Each of the 50 states has one governor. Governors are not members of Congress.',
        'Governors usually serve four-year terms; New Hampshire and Vermont elect them to two-year terms.',
        'This map shows the 36 state governor elections in 2026.',
      ],
    },
  },
  es: {
    president: {
      title: 'Elecciones presidenciales',
      role: 'El presidente dirige el poder ejecutivo federal, hace cumplir las leyes federales, conduce la política exterior y es comandante en jefe de las fuerzas armadas.',
      facts: [
        'El mandato dura cuatro años. Los votantes eligen a los compromisarios, que después votan por el presidente en el Colegio Electoral.',
        'Hay 538 votos electorales; se necesitan 270 para ganar.',
        'No hay elección presidencial en 2026. Este mapa parte de los resultados de 2024; la próxima elección presidencial será en 2028.',
      ],
    },
    senate: {
      title: 'Elecciones al Senado de Estados Unidos',
      role: 'Los senadores representan a sus estados en el Congreso. Redactan y votan leyes federales, confirman muchos nombramientos presidenciales, aprueban tratados y juzgan los procesos de destitución.',
      facts: [
        'El Senado tiene 100 escaños: dos senadores por estado.',
        'El mandato dura seis años. Aproximadamente un tercio de los escaños se elige cada dos años.',
        'Este mapa de 2026 incluye 35 elecciones al Senado: 33 ordinarias y elecciones especiales en Florida y Ohio.',
      ],
    },
    house: {
      title: 'Elecciones a la Cámara de Representantes',
      role: 'Los representantes sirven a los habitantes de sus distritos. Redactan y votan leyes federales, integran comisiones, presentan proyectos tributarios y pueden acusar a funcionarios federales en procesos de destitución.',
      facts: [
        'La Cámara tiene 435 escaños con derecho a voto, distribuidos entre los estados según su población.',
        'El mandato dura dos años. Los 435 escaños se eligen en cada año par.',
        'Un partido necesita 218 de los 435 escaños para tener mayoría.',
      ],
    },
    governor: {
      title: 'Elecciones a gobernador',
      role: 'Cada gobernador dirige el poder ejecutivo de su estado. Aplica las leyes estatales, firma o veta proyectos de ley, nombra funcionarios y gestiona emergencias.',
      facts: [
        'Cada uno de los 50 estados tiene un gobernador. Los gobernadores no forman parte del Congreso.',
        'Por lo general, el mandato dura cuatro años; en Nuevo Hampshire y Vermont dura dos.',
        'Este mapa muestra las 36 elecciones estatales a gobernador de 2026.',
      ],
    },
  },
  fr: {
    president: {
      title: 'Élection présidentielle',
      role: 'Le président dirige le pouvoir exécutif fédéral, fait appliquer les lois fédérales, conduit la politique étrangère et commande les forces armées.',
      facts: [
        'Le mandat dure quatre ans. Les électeurs choisissent des grands électeurs, qui votent ensuite pour le président au sein du collège électoral.',
        'Le collège compte 538 voix ; il en faut 270 pour gagner.',
        'Il n’y a pas d’élection présidentielle en 2026. Cette carte part des résultats de 2024 ; la prochaine élection aura lieu en 2028.',
      ],
    },
    senate: {
      title: 'Élections au Sénat des États-Unis',
      role: 'Les sénateurs représentent leur État au Congrès. Ils rédigent et votent les lois fédérales, confirment de nombreuses nominations présidentielles, approuvent les traités et jugent les procédures de destitution.',
      facts: [
        'Le Sénat compte 100 sièges : deux sénateurs par État.',
        'Le mandat dure six ans. Environ un tiers des sièges est renouvelé tous les deux ans.',
        'Cette carte de 2026 couvre 35 élections sénatoriales : 33 élections ordinaires et des élections partielles en Floride et en Ohio.',
      ],
    },
    house: {
      title: 'Élections à la Chambre des représentants',
      role: 'Les représentants servent les habitants de leur circonscription. Ils rédigent et votent les lois fédérales, siègent en commission, présentent les projets de loi fiscale et peuvent mettre en accusation des responsables fédéraux.',
      facts: [
        'La Chambre compte 435 sièges avec droit de vote, répartis entre les États selon leur population.',
        'Le mandat dure deux ans. Les 435 sièges sont soumis au vote chaque année paire.',
        'Un parti doit obtenir 218 des 435 sièges pour détenir la majorité.',
      ],
    },
    governor: {
      title: 'Élections des gouverneurs',
      role: 'Un gouverneur dirige le pouvoir exécutif de son État. Il applique les lois de l’État, signe ou oppose son veto aux lois, nomme des responsables et gère les urgences.',
      facts: [
        'Chacun des 50 États a un gouverneur. Les gouverneurs ne siègent pas au Congrès.',
        'Le mandat dure généralement quatre ans ; dans le New Hampshire et le Vermont, il dure deux ans.',
        'Cette carte présente les 36 élections des gouverneurs d’État en 2026.',
      ],
    },
  },
  de: {
    president: {
      title: 'Präsidentschaftswahl',
      role: 'Der Präsident leitet die Bundesregierung, sorgt für die Ausführung von Bundesgesetzen, gestaltet die Außenpolitik und ist Oberbefehlshaber der Streitkräfte.',
      facts: [
        'Die Amtszeit beträgt vier Jahre. Die Wähler bestimmen Wahlleute, die im Wahlkollegium den Präsidenten wählen.',
        'Es gibt 538 Wahlleute; für einen Sieg sind 270 Stimmen nötig.',
        '2026 findet keine Präsidentschaftswahl statt. Diese Karte beginnt mit dem Ergebnis von 2024; die nächste Wahl ist 2028.',
      ],
    },
    senate: {
      title: 'Wahlen zum US-Senat',
      role: 'Senatoren vertreten ihre Bundesstaaten im Kongress. Sie beraten und beschließen Bundesgesetze, bestätigen viele Ernennungen des Präsidenten, stimmen Verträgen zu und führen Amtsenthebungsverfahren durch.',
      facts: [
        'Der Senat hat 100 Sitze: zwei Senatoren je Bundesstaat.',
        'Die Amtszeit beträgt sechs Jahre. Etwa ein Drittel der Sitze wird alle zwei Jahre neu gewählt.',
        'Diese Karte zeigt 35 Senatswahlen 2026: 33 reguläre Wahlen und Sonderwahlen in Florida und Ohio.',
      ],
    },
    house: {
      title: 'Wahlen zum US-Repräsentantenhaus',
      role: 'Abgeordnete vertreten die Menschen in ihren Wahlkreisen. Sie beraten und beschließen Bundesgesetze, arbeiten in Ausschüssen, bringen Steuergesetze ein und können Bundesbeamte anklagen.',
      facts: [
        'Das Repräsentantenhaus hat 435 stimmberechtigte Sitze, die nach Bevölkerung auf die Bundesstaaten verteilt sind.',
        'Die Amtszeit beträgt zwei Jahre. Alle 435 Sitze werden in jedem geraden Jahr neu gewählt.',
        'Für eine Mehrheit braucht eine Partei 218 der 435 Sitze.',
      ],
    },
    governor: {
      title: 'Gouverneurswahlen',
      role: 'Ein Gouverneur leitet die Regierung eines Bundesstaates. Er setzt Landesgesetze um, unterzeichnet Gesetze oder legt sein Veto ein, ernennt Beamte und koordiniert in Notlagen.',
      facts: [
        'Jeder der 50 Bundesstaaten hat einen Gouverneur. Gouverneure gehören nicht dem Kongress an.',
        'Die Amtszeit beträgt meist vier Jahre; in New Hampshire und Vermont sind es zwei Jahre.',
        'Diese Karte zeigt die 36 Gouverneurswahlen in den Bundesstaaten im Jahr 2026.',
      ],
    },
  },
  'pt-BR': {
    president: {
      title: 'Eleição presidencial',
      role: 'O presidente lidera o Poder Executivo federal, faz cumprir as leis federais, conduz a política externa e comanda as Forças Armadas.',
      facts: [
        'O mandato é de quatro anos. Os eleitores escolhem delegados, que depois votam para presidente no Colégio Eleitoral.',
        'Há 538 votos no Colégio Eleitoral; são necessários 270 para vencer.',
        'Não há eleição presidencial em 2026. Este mapa parte dos resultados de 2024; a próxima eleição será em 2028.',
      ],
    },
    senate: {
      title: 'Eleições para o Senado dos EUA',
      role: 'Senadores representam seus estados no Congresso. Eles elaboram e votam leis federais, confirmam muitas indicações presidenciais, aprovam tratados e julgam processos de impeachment.',
      facts: [
        'O Senado tem 100 cadeiras: dois senadores por estado.',
        'O mandato é de seis anos. Cerca de um terço das cadeiras vai a voto a cada dois anos.',
        'Este mapa de 2026 cobre 35 eleições para o Senado: 33 regulares e eleições especiais na Flórida e em Ohio.',
      ],
    },
    house: {
      title: 'Eleições para a Câmara dos Representantes',
      role: 'Deputados representam as pessoas de seus distritos. Eles elaboram e votam leis federais, atuam em comissões, apresentam projetos tributários e podem abrir processos de impeachment contra autoridades federais.',
      facts: [
        'A Câmara tem 435 cadeiras com direito a voto, distribuídas entre os estados conforme a população.',
        'O mandato é de dois anos. As 435 cadeiras são disputadas em todos os anos pares.',
        'Um partido precisa de 218 das 435 cadeiras para ter maioria.',
      ],
    },
    governor: {
      title: 'Eleições para governador',
      role: 'Cada governador lidera o Poder Executivo de seu estado. Ele aplica as leis estaduais, sanciona ou veta projetos de lei, nomeia autoridades e coordena emergências.',
      facts: [
        'Cada um dos 50 estados tem um governador. Governadores não fazem parte do Congresso.',
        'O mandato geralmente é de quatro anos; em New Hampshire e Vermont, é de dois anos.',
        'Este mapa mostra as 36 eleições estaduais para governador em 2026.',
      ],
    },
  },
};

const SOURCES: Record<Mode, { label: string; href: string }[]> = {
  president: [
    { label: 'USAGov', href: 'https://www.usa.gov/branches-of-government' },
    { label: 'National Archives', href: 'https://www.archives.gov/electoral-college/about' },
  ],
  senate: [
    { label: 'U.S. Senate: terms', href: 'https://www.senate.gov/senators/qualifications_termsofservice.htm' },
    { label: 'U.S. Senate: powers', href: 'https://www.senate.gov/about/powers-procedures.htm' },
  ],
  house: [{ label: 'U.S. House', href: 'https://www.house.gov/the-house-explained' }],
  governor: [{ label: 'National Governors Association', href: 'https://www.nga.org/governors/powers-and-authority/' }],
};

export function ElectionInfo({ mode }: { mode: Mode }) {
  const [open, setOpen] = useState(false);
  const locale = currentLocale();
  const ui = UI[locale];
  const info = INFO[locale][mode];
  return <>
    <button type="button" className="election-info__trigger" aria-label={ui.button} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <svg className="election-info__icon" viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="8" r="1.1" fill="currentColor" />
      </svg>
      <span className="election-info__label">{ui.short}</span>
    </button>
    {open ? <ElectionInfoDialog key={mode} info={info} ui={ui} sources={SOURCES[mode]} onClose={() => setOpen(false)} /> : null}
  </>;
}

function ElectionInfoDialog({ info, ui, sources, onClose }: { info: Info; ui: typeof UI[Locale]; sources: typeof SOURCES[Mode]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute('open', '');
    return () => {
      if (dialog?.close) dialog.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);
  return <dialog ref={dialogRef} className="election-info" aria-modal="true" aria-labelledby="election-info-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="election-info__head">
      <h2 id="election-info-title">{info.title}</h2>
      <button type="button" className="election-info__close" aria-label={ui.close} onClick={onClose}>×</button>
    </div>
    <p>{info.role}</p>
    <ul>{info.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>
    <div className="election-info__sources">{ui.sources}: {sources.map((source, index) => <span key={source.href}>{index > 0 ? ' · ' : ''}<a href={source.href} target="_blank" rel="noopener noreferrer">{source.label}</a></span>)}</div>
  </dialog>;
}
