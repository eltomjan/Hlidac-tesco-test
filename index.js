const express = require('express');
const fs = require('fs');
const app = express();

exports.tesco = require("./tesco");

async function downloadRest(store)
{
  const file = `data/latest-canonical.${store}.compressed.json`;
  console.error(file);
  const response = await fetch(`https://www.hlidacsupermarketu.cz/${file}`);
  const text = await response.text();
  console.error(`${file} download size ${text.length}`);
  fs.writeFileSync(`output/${file}`, text);
}

async function load()
{
  try {
    let test = await fetch("https://itesco.cz/Ajax?apage=1&limit=6&type=load-more-products&path=/akcni-nabidky/akcni-nabidky-produkty/&get={}");
    test = await test.json();
    console.error(JSON.stringify(test,null,4));
  } catch (e) {
    console.log(e);
  }
  exports.tesco.fetchData();
  for (store of ["lidl", "billa", "penny", "dm", "albert", "globus", /*"tesco",*/ "kaufland"])
    downloadRest(store);
}

app.use(express.static("output"));

app.listen(80);

module.exports = app;

load();
