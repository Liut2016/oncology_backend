const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const fs = require('fs');
const path = require('path');
const xlsx = require('node-xlsx');
const PY_translator=require('pinyin');
router.get('/oa/patients' ,async (ctx, next) => {
    let sql = 'SELECT * FROM PART1;';
    await db.query(sql).then(res => {
        Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    })
});

router.get('/oa/patient/:hos_id', async(ctx, next) => {
   let params = ctx.params;
   let {hos_id} = params;
   let sql = `SELECT * FROM PART1 WHERE PART1_zyh=${hos_id}`;
   await db.query(sql).then(res => {
       Utils.cleanData(res);
       ctx.body = {...Tips[0], data: res[0]}
   }).catch(e => {
       ctx.body = {...Tips[1002], reason:e}
   })
});

router.get('/oa/generate', async(ctx, next) => {
   const xlsx_file = fs.readFileSync(path.join(__dirname, '../data/oncology_key.xlsx'));
   const json_data = xlsx.parse(xlsx_file);
   const front_json = [];
   json_data.forEach((part, index) => {
       const the_part = {};
       const part_index = index;
       the_part['step_description'] = part.name;
       the_part['items'] = [];
       part.data.splice(0, 2);
       part.data.forEach((item, index) => {
           if (item.length !== 0) {
               const temp_item = {};
               temp_item['name'] = item[0];
               let temp_id = `part${part_index}_${PY_translator(item[0], {style: PY_translator.STYLE_FIRST_LETTER})}`;

               temp_item['id'] = temp_id.split(',').join('');
               if (item[3]) {
                   if (item[3].split('/').length > 1 || item[3].split(',').length > 1) {
                       temp_item['type'] = 'radio';
                   } else {
                       temp_item['type'] = 'input';
                   }
               } else {
                   temp_item['type']= 'input';
               }
               item[4] ? temp_item['unit'] = item[4] : temp_item['unit'] = '';
               the_part['items'].push(temp_item);
           }
       });
       front_json.push(the_part);
   });
   const file_promise = new Promise((resolve, reject) => {
       fs.writeFile(path.join(__dirname, '../data/oncology.json'), JSON.stringify(front_json), 'utf8', (err) => {
           if (err) {
               reject(404);
           } else {
               resolve(200)
           }
   })
   });

   await file_promise.then((res) => {
       ctx.body = {...Tips[0], data: 'json生成成功'}
   }).catch((err) => {
       ctx.body = {...Tips[1002], reason:'json生成失败'}
   })
});

router.get('/oa/test', (ctx, next) => {
    console.log(ctx.query);
    ctx.body = {...ctx.params};
});

module.exports = router;