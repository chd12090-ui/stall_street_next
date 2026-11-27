import {useLayoutEffect,useRef} from 'react';

export function Icon({name,extra=''}) {
  return <i aria-hidden="true" className={'ico i-'+name+(extra?' '+extra:'')} />;
}
export function LabDialog({title,children}) {
  return <section className="sheet mental-lab" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <header className="lab-lid">
      <i className="lab-pilot" aria-hidden="true"/>
      <h2 id="dialog-title">{title}</h2>
      <i className="lab-vents" aria-hidden="true"/>
      <button type="button" className="ui-control ui-icon ui-compact lab-close" data-act="dismiss" aria-label="닫기"><Icon name="close"/></button>
    </header>
    <div className="lab-frame">{children}</div>
  </section>;
}
export function DataRow({label,children}) {
  return <div className="data-row"><span>{label}</span><b>{children}</b></div>;
}
// Keep in-progress IME/decimal input and selection when background quotes or the clock change.
export function AmountField({text,...props}) {
  const ref=useRef(null);
  useLayoutEffect(()=>{
    if(ref.current.value!==text)ref.current.value=text;
  });
  return <input {...props} type="text" autoComplete="off" ref={ref} defaultValue={text}/>;
}
export function Sheet({title,tag,theme='',actions,children}) {
  const focusHeading=theme.includes('loan-contract-sheet')||theme.includes('spy-sheet');
  return <section className={'sheet '+theme} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <div className="sheet-head"><div>{tag&&<span className="sheet-tag">{tag}</span>}
      <h2 id="dialog-title" tabIndex={focusHeading?-1:undefined}>{title}</h2></div>{actions}
      <button className="square-btn ui-control ui-icon ui-compact" data-act="dismiss" aria-label="닫기"><Icon name="close"/></button></div>
    {children}
  </section>;
}
