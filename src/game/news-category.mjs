export const newsCategories={
  stock:{label:'종목',icon:'news-stock'},
  market:{label:'시장',icon:'market'},
  international:{label:'국제',icon:'globe'},
  politics:{label:'정치',icon:'news-politics'},
};

const politicalEvents=new Set(['m1-strait','t2-lumen-settlement','w1-convoy','f2-strait-renewal','zelanda-election']);
const companyEvents=new Set(['m2-cold-vans','t1-cathode-test','t3-nova-power','h1-rail-freight','h2-crown-collateral','h3-chip-export','f1-yard-contract']);
const incidentCategories={
  war:'international',border:'international',earthquake:'market',disaster:'market',
  death:'stock',affair:'stock',social:'stock',fraud:'stock',
};

export function newsCategory(story){
  const event=story.event;
  return story.newsCategory??event.newsCategory??incidentCategories[event.incident]??
    (politicalEvents.has(event.id)?'politics':companyEvents.has(event.id)?'stock':'market');
}
