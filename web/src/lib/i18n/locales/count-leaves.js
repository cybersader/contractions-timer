function countLeaves(obj) {
  let c = 0;
  for (const v of Object.values(obj)) {
    if (typeof v === 'object' && v !== null) {
      c += countLeaves(v);
    } else {
      c++;
    }
  }
  return c;
}

for (const f of ['en', 'pt', 'zh', 'it', 'nl']) {
  const d = require('./' + f + '.json');
  console.log(f + '.json:', countLeaves(d));
}
