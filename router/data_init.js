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
const part_xlsx = require('xlsx-extract').XLSX;

const type = Type.type;
const sec_type = second_Type.type;

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
     let csv_buffer = Buffer.from(fs.readFileSync(path.join(__dirname, '../data/first_home_advice/advice1.csv') , {encoding: 'binary'}), 'binary');
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
         let csv_buffer = Buffer.from(fs.readFileSync(path.join(__dirname, `../data/first_home_advice/advice${i}.csv`) , {encoding: 'binary'}), 'binary');
         buffer_array.push(csv_buffer);
     }
     // let csv_buffer = Buffer.from(fs.readFileSync(path.join(__dirname, '../data/first_home_advice/advice1.csv') , {encoding: 'binary'}), 'binary');
     const decode_file = buffer_array.map(buffer => iconv.decode(buffer, 'GBK'));
     //let csv_file = iconv.decode(csv_buffer, 'GBK');
     const options = {
         delimiter: ',',
         quote: '"'
     };
     const allData =  decode_file.map(file => csv.toObject(file, options));
     // const data = [...allData[0], ...allData[1],...allData[2],...allData[3],...allData[4]];
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

     console.log(values.length);
     console.log(values[0].length, values[1].length, values[2].length, values[3].length, values[4].length);
     console.log(process.memoryUsage());

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

     console.log(filtered_data[30]);
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

     const home_key_old = Object.keys(Key_section).map(item => {
         const key = `part1_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         return key.split(',').join('');
     });
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

     const json_home_data = xlsx.parse(home_data)[0].data;
     const json_fee_data = xlsx.parse(home_data)[1].data;
     const home_key = json_home_data[0].map(item => {
         const key = `part1_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         return key.split(',').join('');
     });
     const fee_key = json_fee_data[0].map(item => {
         const key = `part2_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
         return key.split(',').join('');
     });
     // 存储数据前，先整理出所有数据对应的键值，并对特殊情况进行处理，如费用表中的主键part1_bah

     const sql_home = `INSERT INTO SECOND_HOME (${home_key.join(',')}) VALUES ?`;
     const sql_fee = `INSERT INTO SECOND_FEE (${fee_key.join(',')}) VALUES ?`;
     const sql_home_old = `INSERT INTO SECOND_HOME (${home_key_old.join(',')}) VALUES ?`;
     const save_home_data = json_home_data.slice(1);
     const save_fee_data = json_fee_data.slice(1);
     save_home_data.forEach(item => {
         if (item.length === 30)
         item.push('-');
     });
     // **生成存储的sql语句，特别说明xlsx插件对于一行数据的最后一个非空值会认为是最后一项，所以这里得进行补全操作。

     const home_db = await db.query(sql_home, [save_home_data]);
     const fee_db = await db.query(sql_fee, [save_fee_data]);
     const home_db_old = await db.query(sql_home_old, [home_db_data]);

     Promise.all([home_db,fee_db, home_db_old]).then((res) => {
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
        new_lis_data.forEach((item, index) => {
            if(item.length < 11) {
                for (let i = 0; i< 11 - item.length; i++)
                {
                    item.push(null);
                }
            }
        });
        const sql_string = `INSERT INTO SECOND_LIS (${key_array.join(',')}) VALUES ?`;
        const loading = await db.query(sql_string, [new_lis_data]);
        promise_all.push(loading);
        console.log(`part${i} loaded, length = ${new_lis_data.length}`);
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