const versions=["1.21.8","1.21.5","1.20.6","1.20.1","1.19.4"];let selected=localStorage.getItem("version")||versions[0];
function render(){document.getElementById("currentVersion").textContent=selected;document.getElementById("versionList").innerHTML=versions.map(v=>'<div class="version"><span>Minecraft Java '+v+'</span><button onclick="selectVersion(\''+v+'\')">選擇</button></div>').join('')}
function selectVersion(v){selected=v;localStorage.setItem("version",v);render();document.querySelector('[data-page="home"]').click()}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));document.getElementById(b.dataset.page).classList.add("active");document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active")});
document.getElementById("play").onclick=()=>{const s=document.getElementById("status");s.textContent="已選擇 "+selected+"（等待正式帳號驗證）";setTimeout(()=>s.textContent="就緒",2500)};
document.getElementById("ram").oninput=e=>document.getElementById("ramValue").textContent=e.target.value;
render();