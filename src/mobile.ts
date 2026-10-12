/** Track the visible area instead of the layout viewport when the keyboard opens. */
export function installMobileViewport(){
 const sync=()=>{
  const viewport=window.visualViewport
  document.documentElement.style.setProperty('--visible-height',`${viewport?.height??window.innerHeight}px`)
  document.documentElement.style.setProperty('--visible-top',`${viewport?.offsetTop??0}px`)
 }
 const reveal=()=>window.requestAnimationFrame(()=>{
  const active=document.activeElement as HTMLElement|null
  if(active?.closest('.modal'))active.scrollIntoView({block:'nearest',inline:'nearest'})
 })
 const resize=()=>{sync();reveal()}
 const prevent=(event:Event)=>event.preventDefault()
 const pinch=(event:TouchEvent)=>{if(event.touches.length>1)event.preventDefault()}
 const wheel=(event:WheelEvent)=>{if(event.ctrlKey)event.preventDefault()}
 sync()
 window.visualViewport?.addEventListener('resize',resize)
 window.visualViewport?.addEventListener('scroll',sync)
 window.addEventListener('resize',resize)
 document.addEventListener('focusin',reveal)
 document.addEventListener('gesturestart',prevent,{passive:false})
 document.addEventListener('gesturechange',prevent,{passive:false})
 document.addEventListener('touchmove',pinch,{passive:false})
 document.addEventListener('wheel',wheel,{passive:false})
}
