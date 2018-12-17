const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const fs = require('fs');
const path = require('path');
const xlsx = require('node-xlsx');
const PY_translator=require('pinyin');
const csv = require('csvjson');
const iconv = require('iconv-lite');
const first_home_page = require('../db/first_affiliated');

router.get('/oa/init_weight' ,async (ctx, next) => {


       await init_weight().then(async (res) => {
        console.log('after db', res);
        let csv_buffer = Buffer.from(fs.readFileSync(path.join(__dirname, '../data/height_Weight.csv') , {encoding: 'binary'}), 'binary');
        let csv_file = iconv.decode(csv_buffer, 'GBK');
        const options = {
            delimiter: ',',
            quote: '"'
        };
        const Data_section = csv.toObject(csv_file, options).slice(30, 39);
        await save_weight(get_height_data(Data_section)).then(res => {
            console.log('success', res);
            ctx.body = {status: '存储成功'};
        }).catch(e => {
            console.log('failed', e);
            ctx.body = {status: '存储失败'};
        });

    }).catch((e) => {
        console.log(e);
        ctx.body = {state: res};
    });

});

 const get_height_data = (data) => {
     const format_data = [];
     const data_object = {};
     data.forEach(item => {
         const { PATIENT_ID, VITAL_SIGNS_VALUES } = item;
         data_object[PATIENT_ID] = VITAL_SIGNS_VALUES;
     });
    Object.keys(data_object).forEach(key => {
        format_data.push([key, data_object[key]])
    });
     return format_data;
 };

 async function init_weight () {
    let sql = `create table if not exists WEIGHT(zyh INT, weight INT, PRIMARY KEY(zyh)) CHARSET=utf8;`;
    return await db.query(sql);
}

 async function save_weight (data) {
     let sql = `INSERT INTO WEIGHT (zyh, weight) VALUES ?`;
     return await db.query(sql, [data]);
 }


// 一附院病案首页表建立
router.get('/oa/init_home', async(ctx, next) => {
    const home_page_type = first_home_page.home_page_type;
    home_page_type.unshift('INT unsigned not null auto_increment');

    const home_data = fs.readFileSync(path.join(__dirname, '../data/first_home_page.xls'));
    const json_data = xlsx.parse(home_data);
    const original_title = json_data[0].data[0];
    original_title.shift();
    const letter_title = [];
    original_title.forEach(item => {
       item = `part1_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
       let letter_item = item.split(',').join('');
       letter_title.push(letter_item);
    });

    letter_title.unshift('part1_pid');

    const sql_array = [];
    letter_title.forEach((title, index) => {
       sql_array.push(`${title} ${home_page_type[index]}`);
    });
    sql_array.push('PRIMARY KEY (part1_pid)');
    const sql = `CREATE TABLE IF NOT EXISTS FIRST_HOME (${sql_array.join(',')}) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`;
    await db.query(sql).then((res) => {
        ctx.body = {status: '一附院病案首页建表成功'};
    }).catch(e => {
       ctx.body = {status: '一附院病案首页初始化失败'};
    });
});

 // 一附院病案首页数据载入
 router.get('/oa/load_home', async(ctx, next) => {
     const home_data = fs.readFileSync(path.join(__dirname, '../data/first_home_page.xls'));
     const json_data = xlsx.parse(home_data)[0].data;
     const title_array = [];
     json_data[0].shift();
     json_data[0].forEach(title => {
         const letter_title = `part1_${PY_translator(title, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         title_array.push(letter_title.split(',').join(''));
     });
     json_data.shift();
     json_data.forEach(item => {
         item.shift();
     });
     const load_data = json_data.slice(0, 100);
     const sql = `INSERT INTO FIRST_HOME (${title_array.join(',')}) VALUES ?`;
     await db.query(sql, [load_data]).then((res) => {
         ctx.body = {status: '一附院病案首页存储成功'};
     }).catch(e => {
         console.log(e);
         ctx.body = {status: '存储失败'}
     })
 });
module.exports = router;