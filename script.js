const dz = document.getElementById("dropzone");
const fi = document.getElementById("fileInput");
const pv = document.getElementById("preview");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");
const sizeInput = document.getElementById("sizeInput");
const controls = document.getElementById("controls");

const optimgCheckbox = document.getElementById("optimgCheckbox");
let optimgChecked = false;

function updateCheckboxState(){
    if(sizeInput.disabled){
        optimgCheckbox.classList.add("disabled");
    } else {
        optimgCheckbox.classList.remove("disabled");
    }
}

optimgCheckbox.addEventListener("click", () => {
    if(sizeInput.disabled) return;
    optimgChecked = !optimgChecked;
    if(optimgChecked) optimgCheckbox.classList.add("checked");
    else optimgCheckbox.classList.remove("checked");
});

let results = [];

function isValidSize(){
    const val = parseInt(sizeInput.value);
    return val >= 50 && val <= 5000;
}

function updateDropzoneOpacity(){
    dz.style.opacity = sizeInput.value === "" ? 0.4 : 1;
}

function showSizeError(msg = "Primero debes introducir la medida final de las imágenes."){
    alert(msg);
    sizeInput.classList.add("error");
}

sizeInput.addEventListener("focus", () => sizeInput.classList.remove("error"));

// Prevenir cambio de tamaño si ya hay contenido
sizeInput.addEventListener("input", () => {
    if(results.length > 0){
        showSizeError("Primero debes limpiar las imágenes generadas antes de cambiar el tamaño.");
        sizeInput.value = "";
    }
    updateDropzoneOpacity();
});

function updateSizeInputState(){
    sizeInput.disabled = results.length > 0;
    updateCheckboxState();
}

updateDropzoneOpacity();
updateSizeInputState();

dz.onclick = () => {
    if(!isValidSize()) return showSizeError();
    fi.click();
};

dz.ondragover = e => {
    e.preventDefault();
    if(isValidSize()) dz.classList.add("active");
};

dz.ondragleave = () => dz.classList.remove("active");

dz.ondrop = e => {
    e.preventDefault();
    dz.classList.remove("active");
    if(!isValidSize()) return showSizeError();
    processFiles(e.dataTransfer.files);
};

fi.onchange = () => processFiles(fi.files);

function isBackground(r,g,b,a){
    if(a < 10) return true;
    const t = 255 * 0.05;
    return r > 255-t && g > 255-t && b > 255-t;
}

async function loadImage(file){
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = reject;
        img.src = url;
    });
}

async function canvasToBlob(canvas){
    return new Promise(resolve => {
        canvas.toBlob(b => {
            if(b) resolve(b);
            else{
                const dataURL = canvas.toDataURL("image/jpeg", 0.95);
                const arr = dataURL.split(",");
                const mime = arr[0].match(/:(.*?);/)[1];
                const bin = atob(arr[1]);
                const u8 = new Uint8Array(bin.length);
                for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
                resolve(new Blob([u8],{type:mime}));
            }
        }, "image/jpeg", 0.95);
    });
}

async function processFiles(files){
    if(!isValidSize()) return;

    const outputSize = parseInt(sizeInput.value);
    updateSizeInputState(); // deshabilitar mientras haya contenido

    for(const file of files){
        const img = await loadImage(file);

        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d", { willReadFrequently:true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img,0,0);

        const d = ctx.getImageData(0,0,c.width,c.height).data;
        let top=0,bottom=c.height-1,left=0,right=c.width-1;

        const row=y=>{
            for(let x=0;x<c.width;x++){
                const i=(y*c.width+x)*4;
                if(!isBackground(d[i],d[i+1],d[i+2],d[i+3])) return true;
            }
            return false;
        };
        const col=x=>{
            for(let y=0;y<c.height;y++){
                const i=(y*c.width+x)*4;
                if(!isBackground(d[i],d[i+1],d[i+2],d[i+3])) return true;
            }
            return false;
        };

        while(top<bottom&&!row(top))top++;
        while(bottom>top&&!row(bottom))bottom--;
        while(left<right&&!col(left))left++;
        while(right>left&&!col(right))right--;

        const w = right - left + 1;
        const h = bottom - top + 1;
        const size = Math.max(w,h);
        const cx = left + w/2 - size/2;
        const cy = top + h/2 - size/2;

        const out = document.createElement("canvas");
        out.width = outputSize;
        out.height = outputSize;
        const o = out.getContext("2d");
        o.imageSmoothingEnabled = true;
        o.imageSmoothingQuality = "high";
        o.fillStyle = "#fff";
        o.fillRect(0,0,outputSize,outputSize);
        o.drawImage(c,cx,cy,size,size,0,0,outputSize,outputSize);

        const blob = await canvasToBlob(out);
        const previewUrl = URL.createObjectURL(blob);

        results.push({ blob, previewUrl, name: file.name });

        const div = document.createElement("div");
        div.className = "preview-item";
        div.innerHTML = `<div class="preview-frame"><img src="${previewUrl}"></div>`;
        pv.appendChild(div);
    }

    if(results.length){
        dz.style.display = "none";
        downloadBtn.style.display = "inline-block";
        clearBtn.style.display = "inline-block";
        controls.style.borderBottom = "none";
        updateSizeInputState();
    }
}

function downloadAll(){
    results.forEach(r=>{
        let dotIndex = r.name.lastIndexOf(".");
        let base = dotIndex !== -1 ? r.name.slice(0,dotIndex) : r.name;
        let ext = dotIndex !== -1 ? r.name.slice(dotIndex) : ".jpg";
        const a = document.createElement("a");
        a.href = r.previewUrl;
        a.download = optimgChecked ? `${base}-optimg${ext}` : `${base}${ext}`;
        a.click();
    });
}

function resetAll(clearPreview=true){
    results.forEach(r=>URL.revokeObjectURL(r.previewUrl));
    results=[];
    if(clearPreview) pv.innerHTML="";
    dz.style.display="flex";
    downloadBtn.style.display = "none";
    clearBtn.style.display = "none";
    controls.style.borderBottom="1px solid var(--border)";
    updateDropzoneOpacity();
    updateSizeInputState();
    fi.value = ""; 
}
