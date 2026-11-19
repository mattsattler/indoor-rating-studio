/* Mobile navigation presentation only. No changes to tracking, scoring, or stored data. */
(() => {
  'use strict';
  const sidebar=document.querySelector('.sidebar');
  const brand=sidebar?.querySelector('.brand');
  const nav=sidebar?.querySelector('.side-nav');
  if(!sidebar || !brand || !nav || !window.matchMedia) return;
  const breakpoint=window.matchMedia('(max-width: 700px)');
  const button=document.createElement('button');
  button.type='button';
  button.className='mobile-menu-toggle';
  button.setAttribute('aria-controls','studio-primary-navigation');
  button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-label','Open navigation menu');
  button.innerHTML='<span class="mobile-menu-text">Menu</span><span class="mobile-menu-icon" aria-hidden="true"><i></i><i></i><i></i></span>';
  nav.id='studio-primary-navigation';
  brand.appendChild(button);
  const label=button.querySelector('.mobile-menu-text');
  function setOpen(open){
    const value=Boolean(open && breakpoint.matches);
    sidebar.classList.toggle('menu-open',value);
    button.setAttribute('aria-expanded',String(value));
    button.setAttribute('aria-label',value?'Close navigation menu':'Open navigation menu');
    label.textContent=value?'Close':'Menu';
  }
  function syncLayout(){ button.hidden=!breakpoint.matches; if(!breakpoint.matches) setOpen(false); }
  button.addEventListener('click',()=>setOpen(!sidebar.classList.contains('menu-open')));
  nav.addEventListener('click',e=>{if(e.target.closest('button[data-view]'))setOpen(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
  document.addEventListener('pointerdown',e=>{if(sidebar.classList.contains('menu-open')&&!sidebar.contains(e.target))setOpen(false);});
  if(breakpoint.addEventListener)breakpoint.addEventListener('change',syncLayout);
  else if(breakpoint.addListener)breakpoint.addListener(syncLayout);
  syncLayout();
})();
