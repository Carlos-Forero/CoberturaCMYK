document.getElementById('upload-form').addEventListener('submit', function (event) {
    event.preventDefault();
    const file = document.getElementById('pdf-file').files[0];
    if (file) {
        processPDF(file);
    }
});

const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('pdf-file');

fileInput.addEventListener('change', function () {
    const file = fileInput.files[0];
    processPDF(file);
    if (file) {
        document.getElementById('file-info').textContent = `Archivo Cargado: ${file.name}`;
    }
});

dropArea.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
});

dropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    fileInput.files = dt.files; // Update the input file to reflect the dropped file
    if (file) {
        document.getElementById('file-info').textContent = `Archivo Cargado: ${file.name}`;
    }
    processPDF(file);
});

function processPDF(file) {
    const reader = new FileReader();
    reader.onload = function () {
        const typedarray = new Uint8Array(reader.result);

        pdfjsLib.getDocument(typedarray).promise.then(async function (pdf) {
            let totalPages = pdf.numPages;
            let coverage = [];
            let pageSizes =[];

            const progressBar = document.getElementById('progress-bar');
            progressBar.style.width = '0%';

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                let page = await pdf.getPage(pageNum);
                let viewport = page.getViewport({ scale: 1.0 });
                // Obtener el tamaño de la página en puntos
                let pageWidthPoints = viewport.width;
                let pageHeightPoints = viewport.height;

                // Convertir a milímetros (1 punto = 1/72 pulgadas, 1 pulgada = 25.4 mm)
                let pageWidthMM = (pageWidthPoints / 72) * 25.4;
                let pageHeightMM = (pageHeightPoints / 72) * 25.4;

                pageSizes.push({ width: pageWidthMM.toFixed(2), height: pageHeightMM.toFixed(2) });

                let canvas = document.createElement('canvas');
                let context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                let cmykCoverage = calculateCMYKCoverage(imageData.data);
                coverage.push(cmykCoverage);

                // Actualizar barra de progreso
                let progress = (pageNum / totalPages) * 100;
                progressBar.style.width = progress + '%';
                progressBar.textContent = Math.floor(progress) + '%';
            }

            displayCoverageAndSizes(coverage, pageSizes, file.name);
        });
    };
    reader.readAsArrayBuffer(file);
}

function calculateCMYKCoverage(data) {
    let totalPixels = data.length / 4;
    let cCount = 0, mCount = 0, yCount = 0, kCount = 0;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        let k = 1 - Math.max(r / 255, g / 255, b / 255);
        let c = (1 - (r / 255) - k) / (1 - k) || 0;
        let m = (1 - (g / 255) - k) / (1 - k) || 0;
        let y = (1 - (b / 255) - k) / (1 - k) || 0;
        
        if (c > 0.5) cCount++;
        if (m > 0.5) mCount++;
        if (y > 0.5) yCount++;
        if (k > 0.5) kCount++;
    }
    let t = cCount + mCount + yCount + kCount;

    return {
        C: ((cCount / totalPixels) * 100).toFixed(2),
        M: ((mCount / totalPixels) * 100).toFixed(2),
        Y: ((yCount / totalPixels) * 100).toFixed(2),
        K: ((kCount / totalPixels) * 100).toFixed(2),
        T: ((t / totalPixels) * 100).toFixed(2)
    };
}

function displayCoverageAndSizes(coverage, pageSizes, fileName) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `<h2>Resultados de Cobertura CMYK, tamaño y costo</h2>`;
    let costoTotal = 0;
    coverage.forEach((cmyk, index) => {
        let size = pageSizes[index];
        c= cmyk.C;
        m= cmyk.M;
        y= cmyk.Y;
        k= cmyk.K;
        t= cmyk.T;
        let areaPagCM2 = (size.width * size.height)/100;
        let areaCoverturaCM2 = (Number(t) * areaPagCM2)/100;
        // let costoCM2 = (25000/areaPagCM2).toFixed(2);
        let costoCM2 = 6;
        let costo = Math.ceil((areaCoverturaCM2 * costoCM2));
        costoTotal += Number(costo);
        console.log("Area en cm2: "+ areaPagCM2);
        console.log("Costo por cm2: "+ costoCM2);
        console.log("Costo: "+ costo);
        console.log("costoTotal: "+costoTotal);
        resultDiv.innerHTML += `<p><b>Página ${index + 1}:</b> </br>
          C: ${c}%, M: ${m}%, Y: ${y}%, K: ${k}%, Total: ${t}% </br>
          Tamaño de pagina: ${size.width}mm x ${size.height}mm </br>
          Costo: $${costo}</p>`;
    });
    resultDiv.innerHTML += `<p><hr/>
     <b>TOTAL:</br>
     Pagina(s): ${pageSizes.length} </br>
     Costo: $${Math.ceil(costoTotal)} </p>`;
}

// Validacion tipo de archivo
function handleFile() {
    const fileInput = document.getElementById('pdf-file');
    const outputDiv = document.getElementById('result');

    const file = fileInput.files[0];
    if (!file) {
        outputDiv.innerHTML = '<p>No se ha seleccionado ningún archivo.</p>';
        return;
    }

    if (!file.name.endsWith('.pdf')) {
        outputDiv.innerHTML = '<p>El archivo seleccionado no es un PDF.</p>';
        return;
    }
}


