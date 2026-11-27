import {canonicalCountry} from './atlas-data.mjs';

export function flagPath(country){
  const id=canonicalCountry(country);
  return id?'/art/flags/'+id+'.png':'';
}
