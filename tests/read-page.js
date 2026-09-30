// Legge una pagina HTML reinserendo come blocchi inline i JS/CSS estratti in
// assets/ (naviturni-*, cambi-turno-*), cosi' i test continuano a vedere il
// codice della pagina nello stesso ordine in cui il browser lo esegue.
const fs=require('node:fs');

function readPage(file){
  return fs.readFileSync(file,'utf8')
    .replace(/<link rel="stylesheet" href="(assets\/css\/(?:naviturni|cambi-turno)-[a-z-]+\.css)\?v=\d+">/g,
      (_,asset)=>'<style>\n'+fs.readFileSync(asset,'utf8')+'</style>')
    .replace(/<script src="(assets\/js\/(?:naviturni|cambi-turno)-[a-z-]+\.js)\?v=\d+"><\/script>/g,
      (_,asset)=>'<script>\n'+fs.readFileSync(asset,'utf8')+'</script>');
}

module.exports={readPage};
