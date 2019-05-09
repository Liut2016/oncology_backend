const router = require('koa-router')();
const db = require('../db/index');
const fs = require('fs');
const path = require('path');
const xlsx = require('node-xlsx');
const PY_translator=require('pinyin');
const csv = require('csvjson');
const iconv = require('iconv-lite');
const Type = require('../db/first_affiliated');
const second_Type = require('../db/second_affiliated');
const Utils = require('../utils/methods');
const md5 = require('md5');

const type = Type.type;
const sec_type = second_Type.type;
const sec_key = second_Type.key;

router.get('/oa/init_es_results', async (ctx, next) => {
    let bulkbody = [];
    const result = fs.readFileSync(path.join(__dirname, `../data/first_data/first_results/results.xlsx`));
    const result_key = xlsx.parse(result, {cellDates: true})[0].data[0];
    const result_data = xlsx.parse(result, {cellDates: true})[0].data.slice(1);
    const sql_key = result_key.map((item, index) => {
        let key = `part5_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
        return `${key.split(',').join('')}`;
    });
    let completed_data = Utils.completeRow(result_data, 7, null);
    completed_data = completed_data.map((item, i) => {
        const es_item = {};
        sql_key.forEach((keyset, index) => {
            es_item[keyset] = item[index]
        });
        return es_item;
    });
    completed_data.forEach(item => {
        bulkbody.push({
            index: {
                _index: 'first_results',
                _type: 'doc'
            }
        });
        bulkbody.push(item);
    });
    await db.es().bulk({body: bulkbody}).then(res => {
        console.log('here');
    }).catch(err => {
        console.log(err);
    })
});

router.get('/oa/init_weight' ,async (ctx, next) => {
       await init_weight().then(async (res) => {
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
    const home_page_type = type.home_page_type;
    home_page_type.unshift('INT unsigned not null auto_increment');

    const home_data = fs.readFileSync(path.join(__dirname, '../data/first_data/first_home_page.xls'));
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
     const home_data = fs.readFileSync(path.join(__dirname, '../data/first_data/first_home_page.xls'));
     const json_data = xlsx.parse(home_data, {cellDates: true})[0].data;
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
     const load_data = json_data;
     const sql = `INSERT INTO FIRST_HOME (${title_array.join(',')}) VALUES ?`;
     await db.query(sql, [load_data]).then((res) => {
         ctx.body = {status: '一附院病案首页存储成功'};
     }).catch(e => {
         ctx.body = {status: '存储失败'}
     })
 });

 router.get('/oa/init_advice', async(ctx, next) => {
     const types = type.advice_page_type;
     let csv_buffer = Buffer.from(fs.readFileSync(path.join(__dirname, '../data/first_data/first_advice/advice1.csv') , {encoding: 'binary'}), 'binary');
     let csv_file = iconv.decode(csv_buffer, 'GBK');
     const options = {
         delimiter: ',',
         quote: '"'
     };
     const Key_section = csv.toObject(csv_file, options)[0];
     const advice_item = [];
     Object.keys(Key_section).forEach((item, index) => {
         let key = `part2_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         advice_item.push(`${key.split(',').join('')} ${types[index]}`);
     });
     advice_item.unshift('part2_pid INT unsigned not null auto_increment');
     advice_item.push('PRIMARY KEY (part2_pid)');
     advice_item.push('INDEX ZYLSH (part2_zyh(14))');
     const sql = `CREATE TABLE IF NOT EXISTS FIRST_ADVICE (${advice_item.join(',')}) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`;
     await db.query(sql).then(res => {
         ctx.body = {status: '初始化一附院医嘱表成功'};
     }).catch(e => {
         console.log(e);
         ctx.body = {status: '初始化一附院医嘱表失败', error: e};
     })
 });

 router.get('/oa/load_advice', async(ctx, next) => {
     const buffer_array = [];
     for (let i = 1 ;i <6; i++) {
         console.log(`reading file ${i}`);
         let csv_buffer = Buffer.from(fs.readFileSync(path.join(__dirname, `../data/first_data/first_advice/advice${i}.csv`) , {encoding: 'binary'}), 'binary');
         buffer_array.push(csv_buffer);
     }
     // let csv_buffer = Buffer.from(fs.readFileSync(path.join(__dirname, '../data/first_advice/advice1.csv') , {encoding: 'binary'}), 'binary');
     const decode_file = buffer_array.map(buffer => iconv.decode(buffer, 'GBK'));
     //let csv_file = iconv.decode(csv_buffer, 'GBK');
     const options = {
         delimiter: ',',
         quote: '"'
     };
     const allData =  decode_file.map(file => csv.toObject(file, options));
     const data = [...allData[0]];
     const advice_item = [];
     Object.keys(data[0]).forEach((item) => {
         let key = `part2_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         advice_item.push(`${key.split(',').join('')}`);
     });
     const values = [];
     allData.forEach(data => {
         const part = [];
         data.forEach(item => {
             const value = [];
             Object.keys(data[0]).forEach(key => {
                 if (item[key] === '') {
                     value.push(null);
                 } else {
                     value.push(item[key]);
                 }
             });
             part.push(value);
         });
         values.push(part);
     });

     const sql = `INSERT INTO FIRST_ADVICE (${advice_item.join(',')}) VALUES ?`;
     const part1 = await db.query(sql, [values[0]]);
     const part2 = await db.query(sql, [values[1]]);
     const part3 = await db.query(sql, [values[2]]);
     const part4 = await db.query(sql, [values[3]]);
     const part5 = await db.query(sql, [values[4]]);
     Promise.all([part1, part2, part3, part4, part5]).then((res) => {
         ctx.body = {
             status: '数据初始化成功',
             info: res
         }
     }).catch(e => {
         ctx.body = {
             status: '数据初始化失败',
             info: e
         }
     })
 });

 router.get('/oa/init_lis', async (ctx, next) => {
     const types = type.lis_page_type;
     const lis_item = [];
     let csv_buffer = Buffer.from(fs.readFileSync(path.join(__dirname, '../data/first_data/first_lis/1.csv') , {encoding: 'binary'}), 'binary');
     let csv_file = iconv.decode(csv_buffer, 'gbk');
     const options = {
         delimiter: ',',
         quote: '"'
     };
     const key_section = csv.toObject(csv_file, options)[0];
     Object.keys(key_section).forEach((item, index) => {
         let key = `part3_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         lis_item.push(`${key.split(',').join('')} ${types[index]}`);
     });
     lis_item.unshift('part3_pid INT unsigned not null auto_increment');
     lis_item.push('PRIMARY KEY (part3_pid)');
     lis_item.push('INDEX ZYLSH (part3_zylsh(14))');
     const sql = `CREATE TABLE IF NOT EXISTS FIRST_LIS (${lis_item.join(',')}) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`;
     await db.query(sql).then(res => {
         console.log('建表成功');
     }).catch(e => {
         console.log(e);
         console.log('建表失败');
     });

     const promise_all = [];
     const keys = Object.keys(key_section).map((item) => {
         let key = `part3_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         return `${key.split(',').join('')}`;
     });

     for (let i = 1; i<6; i++) {
         const old_lis = fs.readFileSync(path.join(__dirname, `../data/first_data/first_lis/${i}.xlsx`));
         const old_lis_example = xlsx.parse(old_lis, {cellDates: true})[0].data.slice(1);
         const completed_data = Utils.completeRow(old_lis_example, 10, null);
         const sql_string = `INSERT INTO FIRST_LIS (${keys.join(',')}) VALUES ?`;
         const loading = await db.query(sql_string, [completed_data]);
         promise_all.push(loading);
         console.log(`part_${i} loaded, promise=${promise_all.length}`);
     }

     Promise.all(promise_all).then(res => {
         console.log('一附院LIS存储成功');
     }).catch(e => {
         console.log('一附院LIS存储失败', Object.keys(e));
     })
 });

 router.get('/oa/init_mazui', async (ctx, next) => {
     const mazui = fs.readFileSync(path.join(__dirname, `../data/first_data/first_operation/mazui.xls`));
     const mazui_type = type.operation_mazui_type;
     const mazui_key = xlsx.parse(mazui, {cellDates: true})[0].data[0];
     const mazui_data = xlsx.parse(mazui, {cellDates: true})[0].data.slice(1);
     mazui_key.shift();
     const sql_key = mazui_key.map((item, index) => {
         let key = `part4_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         return `${key.split(',').join('')} ${type.generateType(mazui_type[index])}`;
     });
     sql_key.unshift('part4_pid INT unsigned not null auto_increment');
     sql_key.push('PRIMARY KEY (part4_pid)');
     sql_key.push('INDEX ZYLSH (part4_zylsh(14))');
     const sql = `CREATE TABLE IF NOT EXISTS FIRST_MAZUI (${sql_key.join(',')}) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`;
     await db.query(sql).then(res => {
         console.log('建表成功');
     }).catch(e => {
         console.log(e);
         console.log('建表失败');
     });

     const db_key = mazui_key.map(item => {
         let key = `part4_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         return `${key.split(',').join('')}`;
     });
     db_key.unshift('part4_pid');
     const db_sql = `INSERT INTO FIRST_MAZUI (${db_key.join(',')}) VALUES ?`;
     const completed_data = Utils.completeRow(mazui_data, 15, null);
     await db.query(db_sql, [completed_data]).then(res => {
         console.log('导入成功');
     }).catch(e => {
         console.log('导入失败', e.sqlMessage);
     })
 });

 router.get('/oa/init_results', async (ctx, next) => {
    const result = fs.readFileSync(path.join(__dirname, `../data/first_data/first_results/results.xlsx`));
    const result_type = type.result_type;
    const result_key = xlsx.parse(result, {cellDates: true})[0].data[0];
    const result_data = xlsx.parse(result, {cellDates: true})[0].data.slice(1);
    const sql_key = result_key.map((item, index) => {
        let key = `part5_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
        return `${key.split(',').join('')} ${type.generateType(result_type[index])}`;
    });
    sql_key.unshift('part5_pid INT unsigned not null auto_increment');
    sql_key.push('PRIMARY KEY (part5_pid)');
    sql_key.push('INDEX ZYH (part5_zyh)');
    const sql = `CREATE TABLE IF NOT EXISTS FIRST_RESULTS (${sql_key.join(',')}) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`;
    await db.query(sql).then(res => {
        console.log('建表成功');
    }).catch(e => {
        console.log(e);
        console.log('建表失败');
    });

    const db_key = result_key.map(item => {
        let key = `part5_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
        return `${key.split(',').join('')}`;
    });
    const db_sql = `INSERT INTO FIRST_RESULTS (${db_key.join(',')}) VALUES ?`;
    const completed_data = Utils.completeRow(result_data, 7, null);
    await db.query(db_sql, [completed_data]).then(res => {
        console.log('导入成功');
    }).catch(e => {
        console.log('导入失败', e.sqlMessage);
    })
});

/**
 * 初始化一附院历史记录表
 */
router.get('/oa/init_history', async (ctx, next) => {
    const sql = `create table if not exists FIRST_SEARCH_HISTORY (history_pid INT unsigned not null auto_increment, history_text text, history_set JSON, primary key (history_pid)) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`;
    await db.query(sql).then(res => {
        ctx.body = {status: res, text: '创建成功'}
    }).catch(e => {
        ctx.body = {status: e, text: '创建失败'}
    })
 });

 

 /**
 * 初始化二附院历史记录表
 */
router.get('/oa/second_init_history', async (ctx, next) => {
    const sql = `create table if not exists SECOND_SEARCH_HISTORY (history_pid INT unsigned not null auto_increment, history_text text,history_time VARCHAR(50) , history_set JSON, primary key (history_pid)) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`;
    await db.query(sql).then(res => {
        ctx.body = {status: res, text: '创建成功'}
    }).catch(e => {
        ctx.body = {status: e, text: '创建失败'}
    })
 });
/*router.get('/oa/check_patient', async (ctx, next) => {
    const name = await db.query('select part1_xm from FIRST_HOME');
    const name_array = name.map(name => {
       return name['part1_xm']
    });
    console.log('check');
    let zero_patient = 0;
    const zero_patient_array = [];
    name_array.forEach(async (item, index) => {
        const result = await db.query(`select count(*) from FIRST_LIS where part3_hzxm='${item}'`);
        console.log(index,'数量=' ,result[0]['count(*)'], zero_patient);
        if (result[0]['count(*)'] === 0) {
            zero_patient++;
            zero_patient_array.push(index);
        }
    });
    console.log(zero_patient);
});*/



 // 初始化二附院病案首页与费用表
 router.get('/oa/init_home_2', async(ctx, next) => {
    const home_data = fs.readFileSync(path.join(__dirname, '../data/second_data/second_home_key.xlsx'));
    const json_data = xlsx.parse(home_data)[0].data;
    const filtered_data = [];
    json_data.forEach(item => {
        if (item.length !== 0) {
            filtered_data.push({
                name: item[0],
                type: item[1]
            })
        }
    });
    // 从键值表second_home_key中，拿出数据字段名称与类型

    filtered_data.splice(0, 2);
    //去掉多余的几行

    let transed_data = filtered_data.map((item,index) => {
        let part = index > 30 ? 'part2' : 'part1';
        let name = `${part}_${PY_translator(item.name, {style: PY_translator.STYLE_FIRST_LETTER})}`;
        let format_name = name.split(',').join('');
        return {
            name: format_name,
            type: generateType(item.type)
        };
    });
    // 生成对应的首字母键值和存储类型，不同部分有不同的part值

    const home_page_data = transed_data.slice(0, 31).map(item => {
        return `${item.name} ${item.type}`
    });
    const fee_data = transed_data.slice(31).map(item => {
        return `${item.name} ${item.type}`
    });

    // 将此数组转换为键值-类型

    home_page_data.unshift(`part1_pid INT unsigned not null auto_increment`);
    home_page_data.push(`part1_HIS INT`);
    home_page_data.push('PRIMARY KEY (part1_pid)');
    fee_data.unshift(`part2_pid INT unsigned not null auto_increment`);
    fee_data.push(`PRIMARY KEY (part2_pid)`);
    fee_data.push('INDEX BAH (part2_bah)');
    const home_sql = `CREATE TABLE IF NOT EXISTS SECOND_HOME (${home_page_data.join(',')}) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`;
    const fee_sql = `CREATE TABLE IF NOT EXISTS SECOND_FEE (${fee_data.join(',')}) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`;
    // 处理生成存储语句

    const init_home_db = await db.query(home_sql);
    const init_fee_db = await db.query(fee_sql);

    Promise.all([init_home_db,init_fee_db]).then((res) => {
        ctx.body = {status: '首页与费用数据建表成功'}
    }).catch((e) => {
        ctx.body = {status: '建表失败'};
    })
 });

 router.get('/oa/load_home_2', async(ctx, next) => {
     const home_data =  fs.readFileSync(path.join(__dirname, '../data/second_data/home_new.xlsx'));
     // 获取新首页数据

     let csv_buffer = Buffer.from(fs.readFileSync(path.join(__dirname, '../data/second_data/home_old.csv') , {encoding: 'binary'}), 'binary');
     let csv_file = iconv.decode(csv_buffer, 'utf8');
     const options = {
         delimiter: ',',
         quote: '"'
     };
     // 获取老首页数据

     const home_data_old = csv.toObject(csv_file, options);
     const Key_section = home_data_old[0];


     // 根据老首页数据title生成拼音键值

     const home_db_data = [];

     home_data_old.forEach(item => {
         const data_item = [];
         Object.keys(Key_section).forEach(key => {
             if (key === '性别') {
                 data_item.push(item[key] === '男' ? 1 : 2);
             } else {
                 data_item.push(item[key]);
             }
         });
         home_db_data.push(data_item);
     });
     // 进行性别值的映射

     const old_fee_data = [];
     home_db_data.forEach(item => {
        const fee_item = [];
        fee_item.push(item[1]);
        for (let i = 0; i < 21; i ++) {
            fee_item.push(0);
        }
        old_fee_data.push(fee_item);
     });

     const json_home_data = xlsx.parse(home_data)[0].data;
     const json_fee_data = xlsx.parse(home_data)[1].data;
     const home_key = json_home_data[0].map(item => {
         const key = `part1_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         return key.split(',').join('');
     });
     home_key.push('part1_HIS');
     const fee_key = json_fee_data[0].map(item => {
         const key = `part2_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         return key.split(',').join('');
     });
     // 存储数据前，先整理出所有数据对应的键值，并对特殊情况进行处理，如费用表中的主键part1_bah
     const sql_home = `INSERT INTO SECOND_HOME (${home_key.join(',')}) VALUES ?`;
     const sql_fee = `INSERT INTO SECOND_FEE (${fee_key.join(',')}) VALUES ?`;

     const save_home_data = home_db_data.concat(json_home_data.slice(1));
     const save_fee_data = old_fee_data.concat(json_fee_data.slice(1));
     const completed_data = Utils.completeRow(save_home_data, 31, '-');

     // **生成存储的sql语句，特别说明xlsx插件对于一行数据的最后一个非空值会认为是最后一项，所以这里得进行补全操作。
     completed_data.forEach((item, index)=> {
         item.push( index > 1928 ? 1 : 0 );
     });
     const home_db = await db.query(sql_home, [completed_data]);
     const fee_db = await db.query(sql_fee, [save_fee_data]);
     Promise.all([home_db,fee_db]).then((res) => {
         ctx.body = {status: '首页与费用数据导入成功'}
     }).catch((e) => {
         console.log(e);
         ctx.body = {status: '导入失败'};
     })
 });

 router.get('/oa/init_lis_2', async (ctx, next) => {
     const old_lis = fs.readFileSync(path.join(__dirname, '../data/second_data/lis/lis-old.xls'));
     const old_lis_example = xlsx.parse(old_lis)[0].data;
     const keys = old_lis_example[0];
     const types = second_Type.type.lis_type;
     const sql_array = [];
     keys.forEach((item, index) => {
         sql_array.push(`part3_${item} ${types[index]}`)
     });

     sql_array.unshift('part3_pid INT unsigned not null auto_increment');
     sql_array.push('PRIMARY KEY (part3_pid)');
     sql_array.push('INDEX BAH (part3_OUTPATIENT_ID)');

     const sql_string = `CREATE TABLE IF NOT EXISTS SECOND_LIS (${sql_array.join(',')}) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`;
     await db.query(sql_string).then(res => {
         ctx.body = {
             status: '二附院LIS数据建表成功'
         }
     }).catch(e => {
         ctx.body = {
             status: '二附院LIS数据建表失败'
         }
     })
 });


 router.get('/oa/load_oldlis_2', async (ctx, next) => {
    const old_lis = fs.readFileSync(path.join(__dirname, '../data/second_data/lis/lis-old.xls'));
    const old_lis_data = xlsx.parse(old_lis)[0].data.concat(xlsx.parse(old_lis)[1].data.slice(1));
    const key_array = [];
    old_lis_data[0].forEach(item => {
        key_array.push(`part3_${item}`);
    });
    old_lis_data.forEach((item, index) => {
        if(item.length < 11) {
            item.push(null);
        }
    });
    const sql_string = `INSERT INTO SECOND_LIS (${key_array.join(',')}) VALUES ?`;
    await db.query(sql_string, [old_lis_data.slice(1)]).then(res => {
        ctx.body= {
            status: '二附院老LIS数据导入成功'
        }
    }).catch(e => {
        console.log(Object.keys(e));
        console.log(e.code, e.errno, e.sqlMessage);
        ctx.body= {
            status: '二附院老LIS数据导入失败'
        }
    })
});
// 导入老LIS数据

 router.get('/oa/load_newlis_2', async (ctx, next) => {
    let key_array = [];
    const promise_all = [];
    for (let i = 1; i < 18; i ++) {
        const new_lis = fs.readFileSync(path.join(__dirname, `../data/second_data/lis/lis-new/Sheet ${i}.xlsx`));
        const new_lis_data = xlsx.parse(new_lis)[0].data.slice(1);
        if (key_array.length === 0) {
            const keys = xlsx.parse(new_lis)[0].data[0];
            keys.forEach(item => {
                key_array.push(`part3_${item}`)
            });
        }
        const completed_data = Utils.completeRow(new_lis_data, 11, null);
        const sql_string = `INSERT INTO SECOND_LIS (${key_array.join(',')}) VALUES ?`;
        const loading = await db.query(sql_string, [completed_data]);
        promise_all.push(loading);
        console.log(`part${i} loaded, length = ${completed_data.length}`);
    }
    console.log('数据读取完毕，正在载入数据库', `请求数${promise_all.length}`);
    Promise.all(promise_all).then(res => {
        console.log('二附院新LIS数据导入成功');
        ctx.body= {
            status: '二附院老LIS数据导入成功'
        }
    }).catch(e => {
        console.log(Object.keys(e));
        console.log(e.code, e.errno, e.sqlMessage);
        ctx.body= {
            status: '二附院新LIS数据导入失败'
        }
    })
});

// 建表：二附院病理表
router.get('/oa/init_pathology_2', async(ctx,next) => {
    //console.log(sec_key);
    const keys = sec_key.pathology_key;
    const types = sec_type.pathology_type;
    const sql_array = [];
    keys.forEach((item,index) => {
        sql_array.push(`part4_${item} ${types[index]}`);
    });

    sql_array.unshift('part4_pid INT unsigned not null auto_increment');
    sql_array.push('PRIMARY KEY (part4_pid)');
    sql_array.push('INDEX BAH (part4_bah)');

    const sql_string = `CREATE TABLE IF NOT EXISTS SECOND_PATHOLOGY (${sql_array.join(',')}) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`;
    await db.query(sql_string).then(res => {
        ctx.body = {
            status:'二附院病理表SECOND_PATHOLOGY建表成功'
        }
    }).catch(e => {
        ctx.body = {
            status:'二附院病理表SECOND_PATHOLOGY建表失败'
        }
    });
});

// 对二附院病理表中每一条记录进行修改
function dataSolve(data)
{
    // 去掉序号
    data.shift();

    // 把空白处填成‘null’
    for(let i=0;i<data.length;i++)
    {
        if(typeof(data[i]) ===  'undefined') data[i] = null;
    }

    // xlsx插件把最后一个非空值作为最后一项，因此需要把每一条记录补全
    while(data.length < 27) data.push(null);

    // 将病案号处理为数值型
    //if(data[1] != 'null') data[1] = parseInt(data[1]);
    if(data[1]) data[1] = parseInt(data[1]);


    // 将‘远处转移有无’字段映射为数值：空缺 -> -1，无 -> 0，有/是 -> 1
    if(data[9] === '无') data[9] = 0;
    else if(data[9] === '是' || data[9] === '有') data[9] = 1;
    else data[9] = -1;

    // 将‘新辅助治疗’字段映射为数值：空缺 -> -1，是 -> 1，否 -> 0
    if(data[20] === '是') data[20] = 1;
    else if(data[20] === '否') data[20] = 0;
    else data[20] = -1;
}

function dataMerge(data)
{
    let sqlData = [];
    for(let i=0;i<data.length;i++)
    {
        dataSolve(data[i]);
        if(data[i][0] != 'null') sqlData.push(data[i]);
        else{
            data[i].forEach((item,index) => {
                if(item != 'null') sqlData[sqlData.length-1][index] = item;
            });
        }
    }
    //console.log(data);
    return sqlData;
}

// 插入数据：二附院病理表
router.get('/oa/load_pathology_2',async(ctx,next) => {
    const keys = sec_key.pathology_key;
    const file = fs.readFileSync(path.join(__dirname,'../data/second_data/病理v2.xlsx'));
    const data = xlsx.parse(file)[0].data.slice(1);
    const sqlKey = [];
    let sqlData = [];
    keys.forEach((item) => {
        sqlKey.push(`part4_${item}`);
    });
    data.forEach((item) => {
        dataSolve(item);
        //if(item[0] != 'null') sqlData.push(item);
        //console.log(item[0]);
        if(item[0]) sqlData.push(item);
        else{
            //console.log(sqlData);
            item.forEach((item2,index) => {
                //if(item2 != 'null') sqlData[sqlData.length-1][index] = item2;
                if(!(!item2 && typeof(item2) === 'object')) sqlData[sqlData.length-1][index] = item2;
            });
        }
    });

    //console.log(sqlKey);

    //console.log(sqlData);
    const sql_string = `INSERT INTO SECOND_PATHOLOGY (${sqlKey.join(',')}) VALUES ?;`;
    //console.log(sql_string);
    await db.query(sql_string,[sqlData]).then(res => {
        ctx.body = {
            status:'二附院病理表 SECOND_PATHOLOGY 数据导入成功',
            data:sqlData
        }
    }).catch(e => {
        ctx.body = {
            status:'二附院病理表 SECOND_PATHOLOGY 数据导入失败',
            error:e,
            data:sqlData
        }
    });
});

router.get('/oa/generate_json_2', async(ctx, next) => {
    const home_data = fs.readFileSync(path.join(__dirname, '../data/second_data/second_home_key.xlsx'));
    const json_data = xlsx.parse(home_data)[0].data;
    const filtered_data = [];
    json_data.forEach(item => {
        if (item.length !== 0) {
            filtered_data.push({
                name: item[0],
                type: item[1]
            })
        }
    });
    // 从键值表second_home_key中，拿出数据字段名称与类型

    filtered_data.splice(0, 2);
    //去掉多余的几行

    let transed_data = filtered_data.map((item,index) => {
        let part = index > 30 ? 'part2' : 'part1';
        let name = `${part}_${PY_translator(item.name, {style: PY_translator.STYLE_FIRST_LETTER})}`;
        let format_name = name.split(',').join('');
        return {
            type: generateType(item.type),
            text: item.name,
            _key: format_name
        };
    });
    // 生成对应的首字母键值和存储类型，不同部分有不同的part值

    const home_page_data = transed_data.slice(0, 31);
    const fee_data = transed_data.slice(31);
    const data = {
        'part1': home_page_data,
        'part2': fee_data
    };
    fs.writeFileSync(path.join(__dirname, '../generate/hos_2.json'), JSON.stringify(data));
    // 将此数组转换为键值-类型

});

// 建表：一附院数据导出规则表
router.get('/oa/init_exportRule', async(ctx,next) => {
    const sql = 'CREATE TABLE IF NOT EXISTS FIRST_EXPORTRULE (' +
        'part6_pid INT UNSIGNED NOT NULL AUTO_INCREMENT,' +
        'part6_name VARCHAR(64) NOT NULL,' +
        'part6_rule VARCHAR(2048) NOT NULL,' +
        'part6_createUser VARCHAR(128),' +
        'part6_createTime DATETIME DEFAULT CURRENT_TIMESTAMP,' +
        'part6_updateUser VARCHAR(128),' +
        'part6_updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,' +
        'PRIMARY KEY (part6_pid),' +
        'INDEX ID (part6_pid)' +
    ')ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;';
    await db.query(sql).then(res => {
        ctx.body = {status:"一附院数据导出规则表FIRST_EXPORTRULE建表成功"};
    }).catch(e => {
        ctx.body = {status:"一附院数据导出规则表FIRST_EXPORTRULE建表失败"};
    });
});

// 建表：二附院骨密度对应病人信息表，骨密度表，骨代谢表
router.get('/oa/init_bone',async(ctx,next) => {
    let i;
    let sql_array = [];
    let query_array = [];
    const table = [
        {
            name:'SECOND_BONEHOME',
            key:sec_key.boneHome_key,
            type:sec_type.boneHome_type,
            rule:[]
        },
        {
            name:'SECOND_BONEDENSITY',
            key:sec_key.boneDensity_key,
            type:sec_type.boneDensity_type,
            rule:[]
        },
        {
            name:'SECOND_VD',
            key:sec_key.vd_key,
            type:sec_type.vd_type,
            rule:[]
        }
    ];

    for(i = 0;i < 3; i++)
    {
        let num = i + 5;
        table[i].key.forEach((item,index) => {
            table[i].rule.push(`part${num}_${item} ${table[i].type[index]}`);
        })

        table[i].rule.unshift(`part${num}_pid INT unsigned not null auto_increment`);
        table[i].rule.push(`PRIMARY KEY (part${num}_pid)`);
        table[i].rule.push(`INDEX BAH (part${num}_bah)`);

        sql_array.push(`CREATE TABLE IF NOT EXISTS ${table[i].name} (${table[i].rule.join(',')}) ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;`);
        query_array.push(await db.query(sql_array[i]));
    }
    Promise.all(query_array).then(res => {
        ctx.body = {
            status:'二附院骨密度信息表、骨密度表、骨代谢表建表成功'
        }
    }).catch(e => {
        ctx.body = {
            status:'二附院骨密度信息表、骨密度表、骨代谢表建表失败'
        }
    })
})

// 导入数据：二附院骨密度对应病人信息表，骨密度表，骨代谢表

// 注意：使用wps创建的excel文件在用node-xlsx读取时会报 CLSID: Expected 00000000000000000000000000000000 saw 2008020000000000c000000000000046
//      的错误，解决方案是使用Microsoft Office Excel 将文件另存为，然后再进行读取
router.get('/oa/load_bone',async(ctx,next) => {
    let sql_array = [];
    let query_array = [];
    let table = [
        {
            name:'SECOND_BONEHOME',
            key:sec_key.boneHome_key,
            data:[]
        },
        {
            name:'SECOND_BONEDENSITY',
            key:sec_key.boneDensity_key,
            data:[]
        },
        {
            name:'SECOND_VD',
            key:sec_key.vd_key,
            data:[]
        }
    ];
    const file = fs.readFileSync(path.join(__dirname,'../data/second_data/boneDensity_vd.xlsx'));
    const data = xlsx.parse(file)[0].data.slice(2);
    console.log(data);

    // 生成字段名
    for(i=0;i<3;i++){
        let num = i + 5;
        table[i].key = table[i].key.map(item => {return `part${num}_${item}`;});
    }

    data.forEach((item) => {
        let bah = item[0];
        let i;
        
        // 处理首页信息
        let home = item.slice(0,20);
        home.forEach(r => {
            if(typeof(r) === 'undefined') r = null;
        })
        if(!home[2]) home[2] = 0;
        table[0].data.push(home);

        // 处理骨密度信息
        let temp1 = item.slice(20);
        i = 0;
        while(i < (temp1.length <= 56 ? temp1.length : 56))
        {
            if(temp1[i] || temp1[i+1])
            {
                //console.log(temp1[i]);
                let bone = temp1.slice(i,i+7);
                bone.unshift(bah);
                while(bone.length < 8) bone.push(null);
                table[1].data.push(bone);
                //console.log(bone)
                
            }
            i += 7;
        }
        
        // 处理骨代谢信息
        let temp2 = item.slice(76);
        i = 0;
        while(i < temp2.length)
        {
            if(temp2[i] || temp2[i+1])
            {
                let vd = temp2.slice(i,i+8);
                vd.unshift(bah);
                let date = vd[2];
                vd[2] = date.slice(0,4) + '-' + date.slice(4,6) + '-' + date.slice(6,8);
                while(vd.length < 9) vd.push(null);
                table[2].data.push(vd);
                //console.log(vd);
            }
            i += 8;
        }
    });
    
    for(i=0;i<3;i++){
        sql_array.push(`INSERT INTO ${table[i].name} (${table[i].key.join(',')}) VALUES ?;`);
        query_array.push(await db.query(sql_array[i],[table[i].data]));
    }
    
    Promise.all(query_array).then(res => {
        ctx.body = {
            status:'二附院骨密度信息表、骨密度表、骨代谢表数据导入成功',
            boneHome:table[0].data,
            boneDensity:table[1].data,
            vd:table[2].data
        }
    }).catch(e => {
        ctx.body = {
            status:'二附院骨密度信息表、骨密度表、骨代谢表建表失败'
        }
    })
    

    //ctx.body = {home:table[0].data,density:table[1].data,vd:table[2].data}
})


// 创建USER表并初始化新用户
// admin 12345 Chen Sirui 610870693@qq.com stomach_vll <createDate> admin
router.get('/oa/init_user',async (ctx,next) => {
    const sql1 = 'CREATE TABLE IF NOT EXISTS USER (' +
                 'uid INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,' +
                 `name VARCHAR(20) DEFAULT NULL COMMENT '姓名',` +
                 `password VARCHAR(50) NOT NULL COMMENT '密码',` +
                 'first_name VARCHAR(30),' +
                 'last_name VARCHAR(30),' +
                 'email VARCHAR(30),' +
                 `create_time DATETIME NOT NULL COMMENT '注册时间',` +
                 'groups VARCHAR(240),' +
                 'role VARCHAR(30),' +
                 'PRIMARY KEY (uid),' +
                 'UNIQUE KEY (name))' +
                 'ENGINE=InnoDB AUTO_INCREMENT=1 CHARSET=utf8;';
    
    const sql2 = 'INSERT ' +
                 'INTO USER (name,password,first_name,last_name,email,groups,create_time,role) ' +
                 'VALUES (?,?,?,?,?,?,?,?);';

    let createDate = new Date();
    let user = ['admin',md5('12345'),'Sirui','Chen','610870693@qq.com','partents1,partents2',createDate,'admin'];
    
    await db.query(sql1).then(async res1 => {
        await db.query(sql2,user).then(res2 => {
            ctx.body = {status : "用户表USER初始化成功",user : user};
        }).catch(e => {
            ctx.body = {status : "用户表USER初始化失败",error : e};
        })
    }).catch(e => {
        console.log(e);
        ctx.body = {status : "用户表USER建表失败"};
    })
})

generateType = (type) => {
    switch (type) {
        case '数字':
            return 'INT';
        case '长数字':
            return 'BIGINT';
        case '长字符串':
            return 'VARCHAR(300)';
        case '字符串':
            return 'VARCHAR(120)';
        case '数值':
            return 'INT';
        case '时间':
            return 'VARCHAR(60)';
        case '小数字':
            return 'DECIMAL(10, 2)';
        default:
            return 'TEXT'
    }
};
module.exports = router;
