import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {transformSync} from 'esbuild';

// Render production React components with the same native game-module identities.
process.env.NODE_ENV='production';
const {createElement}=await import('react');
const {renderToStaticMarkup}=await import('react-dom/server');

export async function loadJsx(url) {
  const hook=registerHooks({
    load(path,context,next) {
      if(!path.endsWith('.jsx'))return next(path,context);
      const source=readFileSync(new URL(path),'utf8');
      return {format:'module',shortCircuit:true,
        source:transformSync(source,{loader:'jsx',jsx:'automatic',format:'esm'}).code};
    },
  });
  try{return await import(url.href);}
  finally{hook.deregister();}
}
export const renderView=(component,props)=>renderToStaticMarkup(createElement(component,props));
