'use strict';

// Matching transparent : ces scores sont des indices textuels, pas un avis RH ni une décision automatique.
const SKILLS = [
  'excel','word','powerpoint','outlook','office','pack office','google workspace',
  'gestion de projet','management','relation client','service client','accueil','vente',
  'commercial','prospection','administratif','comptabilite','comptabilité','facturation',
  'ressources humaines','recrutement','paie','logistique','stock','livraison',
  'maintenance','qualite','qualité','securite','sécurité','production','usinage',
  'cao','solidworks','autocad','metrologie','métrologie','industrie','mecanique',
  'mécanique','electronique','électronique','data','sql','python','javascript','react',
  'html','css','design','figma','photoshop','illustrator','communication','marketing',
  'seo','anglais','allemand','espagnol','formation','pedagogie','pédagogie',
  'soins','sante','santé','aide a domicile','aide à domicile','restauration',
  'cuisine','nettoyage','organisation','autonomie','teletravail','télétravail',
  'analyse','reporting','crm','sap','erp','permis b'
];
const STOP = new Set(('avec dans pour chez vous nous votre notre leurs leur entre cette celui ainsi mais donc cela faire avoir plus tout toutes tous tout autre plusieurs être sont les des une aux sur par pas qui que qu un du de le la et en au ou ce se à a d l the and for with from home full time job role company ability').split(/\s+/));
const clean = value => String(value == null ? '' : value).trim();
function norm(value) {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9+#]+/g,' ').replace(/\s+/g,' ').trim();
}
function words(value) {
  return [...new Set(norm(value).split(' ').filter(w=>w.length>=3 && !STOP.has(w)))];
}
function skillsIn(value) {
  const hay = ' ' + norm(value) + ' ';
  return [...new Set(SKILLS.map(norm))].filter(s=>hay.includes(' ' + s + ' '));
}
function analyseCV(cvText) {
  const text = clean(cvText);
  return {skills: skillsIn(text), words: words(text).slice(0,160), characters:text.length};
}
function accessibleMention(job) {
  const s = norm([job.title,job.excerpt,job.description].filter(Boolean).join(' '));
  return /\b(rqth|boeth|handicap|handi accue|handi engage|handi recrute|emploi inclusif|amenagement de poste|poste amenage|inclusion handicap)\b/.test(s);
}
function scoreJob(profile,job) {
  const cv = analyseCV(profile.cvText || '');
  const relevant = norm([job.title,job.excerpt,job.contract].join(' '));
  const desired = norm(profile.targetRole);
  const title = norm(job.title);
  const targetWords = words(desired);
  const targetHits = targetWords.filter(w => title.includes(w)).length;
  const targetScore = targetWords.length ? Math.round(45*targetHits/targetWords.length) : 0;
  const matchedSkills = cv.skills.filter(s => relevant.includes(s));
  const jobSkills = skillsIn([job.title,job.excerpt].join(' '));
  const missingSkills = jobSkills.filter(s=>!cv.skills.includes(s));
  const skillScore = jobSkills.length ? Math.round(35*matchedSkills.length/jobSkills.length) : 0;
  const cvTokens = cv.words.filter(w=>w.length>3);
  const hits = cvTokens.filter(w => relevant.includes(w));
  const overlapScore = cvTokens.length ? Math.round(20*hits.length/Math.max(8,Math.min(30,cvTokens.length))) : 0;
  const noProfile = !desired && cv.characters < 35;
  const score = noProfile ? null : Math.min(100,targetScore+skillScore+overlapScore);
  return {score,matchedSkills,missingSkills,matchedTerms:hits.slice(0,8)};
}
function draftLetter(profile,job,opts={}) {
  const name=clean(profile.fullName) || '[Votre nom]';
  const company=clean(job.company) || '[Nom de l’entreprise]';
  const title=clean(job.title) || '[Intitulé du poste]';
  const skills=analyseCV(profile.cvText || '').skills;
  const jobSkills=skillsIn([job.title,job.excerpt].join(' '));
  const aligned=jobSkills.filter(s=>skills.includes(s)).slice(0,3);
  const evidence=aligned.length ? aligned.join(', ') : skills.slice(0,3).join(', ');
  const cvExcerpt=clean(profile.cvText).split(/\n+/).map(s=>s.trim()).find(s=>s.length>18 && s.length<155 && !/@/.test(s)) || '';
  const skillLine = aligned.length
    ? 'Mon parcours fait apparaître des compétences en ' + evidence + ', en lien avec les attentes du poste.'
    : evidence ? 'Mon CV met notamment en avant les domaines suivants : ' + evidence + '. Je serais heureux(se) de vous présenter leur pertinence pour ce poste.'
      : 'Je souhaiterais vous présenter mon parcours et expliquer concrètement en quoi il peut répondre aux besoins de votre équipe.';
  const context=clean(job.excerpt) ? 'Votre annonce pour le poste de ' + title + ' a retenu mon attention.' : 'Je souhaite vous proposer ma candidature au poste de ' + title + '.';
  const rqth = opts.discloseRqth === true ? '\n\nJe bénéficie d’une reconnaissance de la qualité de travailleur handicapé (RQTH). Je serais disponible pour échanger, si nécessaire, sur les conditions de travail adaptées au poste.' : '';
  return [
    name,
    '',
    'Objet : Candidature au poste de ' + title,
    '',
    'Madame, Monsieur,',
    '',
    context + ' Je vous adresse ma candidature et mon curriculum vitæ.',
    '',
    skillLine + (cvExcerpt ? ' Mon parcours comprend notamment : ' + cvExcerpt.replace(/[.!?]+$/, '') + '.' : ''),
    '',
    'Je serais ravi(e) d’échanger avec vous sur vos attentes, les missions proposées et la manière dont je pourrais contribuer à votre activité.' + rqth,
    '',
    'Je vous remercie de l’attention portée à ma candidature et reste à votre disposition pour un entretien.',
    '',
    'Veuillez agréer, Madame, Monsieur, l’expression de mes salutations distinguées.',
    '',
    name
  ].join('\n');
}
module.exports = {analyseCV,scoreJob,accessibleMention,draftLetter,norm,skillsIn};
