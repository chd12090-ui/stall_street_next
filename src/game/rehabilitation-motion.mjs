export const rehabilitationPaperImpactMs=268;
export const rehabilitationSlapImpactMs=622;
const slapFrames=[[465,9],[565,10],[rehabilitationSlapImpactMs,11],[698,12],[765,13],[840,14],[988,15]];

// Already-open v54 screens can still request the old, full-frame image.
export const rehabilitationSpriteFrames=16;
const legacyThrow=[[0,1],[112,2],[185,3]];
export const rehabilitationMotions={
  win:{duration:760,frames:[...legacyThrow,[rehabilitationPaperImpactMs,4],[327,5],[445,6],[592,7]]},
  slap:{duration:1164,frames:[...legacyThrow,[rehabilitationPaperImpactMs,8],...slapFrames]},
};

export const rehabilitationScene={width:162,height:132};
export const rehabilitationAtlas={left:12,top:32,width:126,height:90,frames:21};

const prepareThrow=[[0,1],[105,2],[155,16],[210,3]];

export const rehabilitationPaperMotions={
  win:{duration:760,frames:[...prepareThrow,[rehabilitationPaperImpactMs,4],[310,17],[367,5],[427,6],[506,18],[584,7]]},
  slap:{duration:1164,frames:[...prepareThrow,[rehabilitationPaperImpactMs,8],[322,19],[397,20],...slapFrames]},
};
