const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const https = require('https');

exports.tesco = require("./tescoProxy2");

const directoryPath = "./output/";

async function downloadRest(store)
{
  const file = `data/latest-canonical.${store}.compressed.json`;
    const response = await fetch(`https://www.hlidacsupermarketu.cz/${file}`);
    const text = await response.text();
    fs.writeFileSync(`output/${file}`, text);
}

async function load()
{
  const exec = require('child_process').exec;
  function process(error, stdout, stderr) {
      //TODO: process result or logging.
      console.error(stdout, error, stderr);
  }
  exec("ping -n 1 104.129.207.9", process);
  exec("ping -n 1 nakup.itesco.cz", process);

  const tescoItems = await exports.tesco.fetchData();
  fs.writeFileSync("output/data/latest-canonical.tesco.compressed.json", JSON.stringify(tescoItems));
  for (store of ["lidl", "billa", "penny", "dm", "albert", "globus", /*"tesco",*/ "kaufland"])
    await downloadRest(store);
}

app.use(express.static("output"));

app.listen(80);

module.exports = app;

load();
