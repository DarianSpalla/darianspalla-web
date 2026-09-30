const menu=document.getElementById('mobileMenu');
const toggle=document.querySelector('.hamburger');
if(menu&&toggle){
 toggle.setAttribute('aria-controls','mobileMenu');toggle.setAttribute('aria-expanded','false');
 new MutationObserver(()=>{const open=menu.classList.contains('open');toggle.setAttribute('aria-expanded',String(open));document.body.style.overflow=open?'hidden':''}).observe(menu,{attributes:true,attributeFilter:['class']});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.classList.contains('open')){menu.classList.remove('open');toggle.focus()}});
}
document.querySelectorAll('input[type=email]').forEach(e=>{e.autocomplete='email'});
document.querySelectorAll('input[type=password]').forEach(e=>{e.autocomplete='current-password'});
window.handleSubmit=function(btn){
 const form=btn.closest('.contacto-form');const inputs=form.querySelectorAll('input');
 const email=form.querySelector('input[type=email]');
 if(!inputs[0].value.trim()){inputs[0].focus();inputs[0].reportValidity();return}
 if(!email.value||!email.checkValidity()){email.reportValidity();email.focus();return}
 const name=inputs[0].value.trim();const interest=form.querySelector('select').value;const message=form.querySelector('textarea').value.trim();
 const text='Hola Darian, soy '+name+'.\nEmail: '+email.value+'\nInterés: '+interest+'\n'+message;
 window.open('https://wa.me/5491122676200?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');
};
document.querySelectorAll('.contacto-form label').forEach((label,i)=>{const field=label.parentElement.querySelector('input,select,textarea');if(field){field.id=field.id||'contact-field-'+i;label.htmlFor=field.id}});
