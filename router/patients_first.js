const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const { Parser } = require('json2csv');
//const fs = require('fs');
const _ = require('lodash');

const basic_conditions = {
    patientID: 'part1_zylsh',
    patientName: 'part1_xm',
    Disease: 'part1_zzd'
};

const part_map = {
    'part1': 'FIRST_HOME',
    'part2': 'FIRST_ADVICE',
    'part3': 'FIRST_LIS',
    'part4': 'FIRST_MAZUI',
    'part5': 'FIRST_RESULTS'
};
const gender_map = {
    '1': '男',
    '2': '女'
};

const form = {
    病案首页: 'FIRST_HOME',
    //费用明细: 'SECOND_FEE',
}

const home_keys = 'part1_pid,part1_zylsh,part1_xm,part1_xb,part1_nl,part1_zzd,part1_rysj,part1_cysj';
const advice_keys = ['part2_yzlb', 'part2_xmmc', 'part2_xmzl', 'part2_mcjl', 'part2_gg', 'part2_jldw', 'part2_zxdw',
    'part2_jjdw', 'part2_pcdm','part2_pcmc','part2_yfmc','part2_kssj','part2_jssj'
];

// 查询所有病人记录（已过期）
router.get('/oa/patients' ,async (ctx, next) => {
    let sql = 'SELECT * FROM PART1;';
    await db.query(sql).then(res => {
        Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    })
});

// 根据住院号查询病人信息（已过期）
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

// 查询一附院与二附院的LIS数据
async function queryLis(table){
    let key = {
        FIRST_LIS : {
            key1 : 'part3_xmmc',
            key2 : 'part3_xxmmc'
        },
        SECOND_LIS : {
            key1 : 'part3_TEST_ORDER_NAME',
            key2 : 'part3_CHINESE_NAME'
        }
    };
    let data = {};
    sql = `select ${key[table].key1},${key[table].key2} from ${table};`;

    await db.query(sql).then((res) =>{
        res.forEach(element => {
            if(element[key[table].key1] in data) data[element[key[table].key1]].push(element[key[table].key2]);
            else{
                let s = [];
                s.push(element[key[table].key2]);
                data[element[key[table].key1]] = s;
            }
        });

        Object.keys(data).forEach(element => {
            data[element] = _.uniq(data[element]);
            //data[element] = Array.from(new Set(data[element]));
        });

    }).catch(e = {

    });

    return data;
}


// 一附院和二附院所有表单字段的map
router.get('/oa/index',async(ctx,next) => {
    //queryLis('FIRST_LIS');
    //queryLis('FIRST_LIS').then(res => {console.log(res);});
    //console.log(queryLis('FIRST_LIS');
    let sql = `select TABLE_NAME,COLUMN_NAME from information_schema.COLUMNS where TABLE_SCHEMA=\'${db.config.database}\';`;
    await db.query(sql).then(async (res) => {
        let index = {};
        res.forEach(element => {
            if(element['TABLE_NAME'] in index) index[element['TABLE_NAME']].push(element['COLUMN_NAME']);
            else{
                let s = [];
                s.push(element['COLUMN_NAME']);
                index[element['TABLE_NAME']] = s;
            }
        });

        await Promise.all([queryLis('FIRST_LIS'),queryLis('SECOND_LIS')]).then(res => {
               index['FIRST_LIS'].push(res[0]);
               index['SECOND_LIS'].push(res[1]);
            });

        // console.log(index);
        // console.log(Object.keys(index));

        ctx.body = {...Tips[0],index:index};
    }).catch(e => {
        ctx.body = {...Tips[1002],error:e};
    });
});

// 将Index所有字段信息保存为csv文件并提供下载
router.get('/oa/exportIndex',async(ctx,next) => {
    let sql = `select TABLE_NAME,COLUMN_NAME from information_schema.COLUMNS where TABLE_SCHEMA=\'${db.config.database}\';`;
    await db.query(sql).then(async (res) => {
        let csvData = [];
       res.forEach(element => {
           let data = {};
           //data = JSON.parse(JSON.stringify(element));
           data = element;
           csvData.push(data);
       });
       await Promise.all([queryLis('FIRST_LIS'),queryLis('SECOND_LIS')]).then(res => {
           let temp1 = {
               TABLE_NAME:"FIRST_LIS",
               COLUMN_NAME:res[0]
           };
           let temp2 = {
               TABLE_NAME:"SECOND_LIS",
               COLUMN_NAME:res[1]
           };
           csvData.push(temp1);
           csvData.push(temp2);

        });

        //ctx.body = {...Tips[0],index:index};
        let fields = Object.keys(csvData[0]);
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(csvData);

        ctx.set('Content-disposition',`attachment;filename=index.csv`);
        ctx.statusCode = 200;
        //ctx.body = fs.createReadStream(index);
        ctx.body = csv;
    }).catch(e => {
        ctx.body = {...Tips[1002],error:e};
    });
});

// 根据住院号查询病人信息和医嘱信息
router.get('/oa/patient_1/:zyh', async(ctx, next) => {
    let params = ctx.params;
    let {zyh} = params;
    let sql_home = `SELECT * FROM FIRST_HOME WHERE part1_zylsh='${zyh}'`;
    let sql_advice = `SELECT * FROM FIRST_ADVICE WHERE part2_zyh = '${zyh}'`;
    const home = await db.query(sql_home);
    const advice = await db.query(sql_advice);
    Promise.all([home, advice]).then(res => {
        // Utils.cleanData(res);
        ctx.body = {...Tips[0], data: {home: res[0], advice: Utils.generateCategory(res[1], 'part2_yzlb')}}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason:e}
    })
});


//post方法实现一附院所有病人病案首页信息分页
router.post('/oa/patients1/',async (ctx, next) =>{
    var pagesize = parseInt(ctx.request.body.pagesize);
    var pageindex = parseInt(ctx.request.body.pageindex);
    const start = (pageindex-1);
    const home_fields = ['part1_pid', 'part1_zyh', 'part1_zylsh', 'part1_xm', 'part1_xb', 'part1_nl', 'part1_zzd', 'part1_rysj', 'part1_cysj'];
    let sql1 = `SELECT ${home_fields.join(',')} FROM FIRST_HOME  limit ${start},${pagesize};`;
    let sql2 = `SELECT COUNT(*) FROM FIRST_HOME;`;
    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1, part2]).then((res) => {
        num = res[1][0]['COUNT(*)'];
        res[0].map(item => {
            item['part1_rysj'] = item['part1_rysj'].substr(0, 16);
            item['part1_cysj'] = item['part1_cysj'].substr(0, 16);
            item['part1_xb'] = gender_map[item['part1_xb']];
            return item;
        });
        data = res[0];
        //Utils.cleanData(res);
        ctx.body = {...Tips[0],count_num:num,data:data};

    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e}
    })
});

/**
 * 目前的ES与filter结合的API
 */
router.post('/oa/filter1', async (ctx, next) => {
    /**
     * 这里规定了所有病案首页包含的字段
     * @type {string[]}
     */
    let home_fields = ['part1_pid', 'part1_zyh', 'part1_zylsh', 'part1_xm', 'part1_xb', 'part1_nl', 'part1_zzd', 'part1_rysj', 'part1_cysj'];
    const params = ctx.request.body;
    const start = params['pageindex'] - 1;
    const related_zyh = [];
    const zyh_highlight = {};

    /**
     * 如果参数中的条件为空数组，则直接查询数量和分页条目
     */
    if (params.conditions.length === 0) {
        let sql1 = `SELECT ${home_keys} FROM FIRST_HOME LIMIT ${start}, ${params['pagesize']}`;
        let sql2 = `SELECT COUNT(*) FROM FIRST_HOME`;
        const get_patient = db.query(sql1);
        const get_count = db.query(sql2);
        await Promise.all([get_patient, get_count]).then(res => {
            res[0].map(item => {
                /**
                 * 这里需要对时间格式进行一下裁剪
                 * @type {boolean|*|*|string}
                 */
                item['part1_rysj'] = item['part1_rysj'].substr(0, 16);
                item['part1_cysj'] = item['part1_cysj'].substr(0, 16);
                item['part1_xb'] = gender_map[item['part1_xb']];
                return item;
            });
            ctx.body = {...Tips[0],count_num:res[1][0]['COUNT(*)'] ,data:res[0]};
        }).catch(e => {
            ctx.body = {...Tips[1002], reason:e}
        })
    } else {
        /**
         * 接下来就是较复杂的情况，如果存在过滤条件（无所谓是ES还是sql）
         * @type {Array} 前端传来的条件对象数组（刘璇规定的各种属性）
         */

        /**
         * 初始化住院号数组
         * @type {Array}
         */
        let zyh_array = [];

        /**
         * 初始化ES条件数组、 sql过滤数组
         * @type {Array}
         */
        const elastic_conditions = [];
        const filter_conditions = [];
        params.conditions.forEach(condition => {
            condition.isElastic ? elastic_conditions.push(condition) : filter_conditions.push(condition);
        });
        const condition_array = [];
        const part_has_condition = ['FIRST_HOME a'];
        const all_condition = [];
        const join_array = [];

        /**
         * 这里对各个部分的条件数组进行了初始化，规定了其主键，以及由于要使用inner join来进行多表查询，所以需要涉及在sql语句中给各个表赋值临时变量（a. b. c....）
         * @type {{FIRST_MAZUI: {main: string, items: Array, table: string}, FIRST_RESULTS: {main: string, items: Array, table: string}, FIRST_ADVICE: {main: string, items: Array, table: string}, FIRST_LIS: {main: string, items: Array, table: string}, FIRST_HOME: {main: string, items: Array, table: string}}}
         */
        const condition_part = {
            'FIRST_HOME': {
                items: [],
                table: 'a',
                main: 'part1_zyh'
            },
            'FIRST_ADVICE': {
                items: [],
                table: 'b',
                main: 'part2_zylsh'
            },
            'FIRST_LIS': {
                items: [],
                table: 'c',
                main: 'part3_zyh'
            },
            'FIRST_MAZUI': {
                items: [],
                table: 'd',
                main: 'part4_zylsh'
            },
            'FIRST_RESULTS': {
                items: [],
                table: 'e',
                main: 'part5_zyh'
            },
        };

        /**
         * 如果存在ES关键字搜索，则进行相应ES搜索，并生成最后的住院号
         */
        if (elastic_conditions.length > 0) {
            await elasticQuery(elastic_conditions[0].inputValue).then(res => {
                res['hits']['hits'].forEach(item => {
                    let high_light;
                    related_zyh.push(item._source['part5_zyh']);
                    Object.keys(item.highlight).forEach((part, index) => {
                        if (index === 0) {
                            high_light = item.highlight[part];
                        }
                    });
                    zyh_highlight[item._source['part5_zyh']] = high_light;
                });
                zyh_array = generateEsZyh(res);
            });
        }

        /**
         * 为所有的sql过滤条件生成相应的sql查询语句
         */
        filter_conditions.forEach(item => {
            condition_array.push(generateCondition(item));
        });

        /**
         * 将上一步的语句放在前面初始化的各个数组中，用于最后的组合
         */
        condition_array.forEach(item => {
            condition_part[item.part].items.push(item.sql);
        });

        /**
         * 把所有含有过滤条件的part数组找出来，整合成一个条件数组
         */
        Object.keys(condition_part).forEach((key, index) => {
            if (condition_part[key].items.length > 0 && index > 0) {
                part_has_condition.push(`${key} ${condition_part[key].table}`);
            }
            all_condition.push(...condition_part[key].items);
        });

        /**
         * 这里你一定会需要修改，之前只做了part1和part5的联合查询，所以在这里写死了，后面需要修改
         */
        if (part_has_condition.length === 2) {
            join_array.push('part1_zyh = part5_zyh');
        }
        home_fields = home_fields.map(item => {
            return `a.${item}`;
        });

        /**
         * 这里就是一系列生成inner join语句的步骤，比较繁琐，可以优化
         * @type {string}
         */
        const table_map = part_has_condition.join(',');
        const column_map = `${home_fields.join(',')}`;
        let condition_map = `${join_array.concat(all_condition).join(' and ')}`;
        if (zyh_array.length > 0 && condition_array.length > 0) {
            condition_map = `${condition_map} and a.part1_zyh in (${zyh_array.join(',')})`;
        } else if (zyh_array.length > 0 && condition_array.length === 0) {
            condition_map = `a.part1_zyh in (${zyh_array.join(',')})`;
        }
        const sql = `select ${column_map} from ${table_map} where ${condition_map}`;

        /**
         * 进行最后的查询
         */
        await db.query(sql).then(res => {
            const uniq_data = Utils.uniqArray(res, 'part1_pid');
            uniq_data.forEach(item => {
                item['part1_rysj'] = item['part1_rysj'].substr(0, 16);
                item['part1_cysj'] = item['part1_cysj'].substr(0, 16);
                item['part1_xb'] = gender_map[item['part1_xb']];
                item.highlight = zyh_highlight[item['part1_zyh']];
            });
            ctx.body = {...Tips[0], count_num: uniq_data.length, data: uniq_data.slice(start, start + params['pagesize'])};
        }).catch(e => {
        });
    }
});

/**
 * 这是我实现的，根据你规定的从前端传来的条件对象，生成条件语句的函数
 * @param condition 条件对象
 * @returns {{part: *, sql: string}} 该条件语句包含哪个part的表，对于的sql是什么
 */
function generateCondition(condition) {
    const table_map = {
        'part1': 'a',
        'part2': 'b',
        'part3': 'c',
        'part4': 'd',
        'part5': 'e'
    };
    if (condition['isNumber'] ) {
        const result = {
            part: part_map[condition['databaseField'].split('_')[0]],
            sql: `${table_map[condition['databaseField'].split('_')[0]]}.${condition['databaseField']} between ${condition['inputValue1']} and ${condition['inputValue2']}`
        };
        return result;
    }
    if (condition['isNotNumber']) {
        if (condition['databaseField'] === 'part1_xb') {
            const result = {
                part: part_map[condition['databaseField'].split('_')[0]],
                sql: `${table_map[condition['databaseField'].split('_')[0]]}.${condition['databaseField']} = ${condition['selectedInt']}`
            };
            return result;
        }
        const result = {
            part: part_map[condition['databaseField'].split('_')[0]],
            sql: `${table_map[condition['databaseField'].split('_')[0]]}.${condition['databaseField']} like '%${condition['inputValue']}%'`
        };
        return result;
    }
    if (condition['isTime']) {
        const result = {
            part: part_map[condition['databaseField'].split('_')[0]],
            sql: `${table_map[condition['databaseField'].split('_')[0]]}.${condition['databaseField']} between '${condition['startTime']}' and '${condition['endTime']}'`
        };
        return result;
    }
}

/**
 * 根据住院号数组，返回所有查询的患者首页结果（为影像检查结果后的过滤查询服务）
 * @param zyh_array 注意是住院号，不是住院流水号。
 * @returns {Promise<void>}
 */
async function queryHome(zyh_array) {
    const zyh = zyh_array.join(',');
    const home_fields = ['part1_pid', 'part1_zyh', 'part1_zylsh', 'part1_xm', 'part1_zzd'];
    return db.query(`SELECT ${home_fields.join(',')} FROM FIRST_HOME WHERE part1_zyh IN (${zyh})`);
}

/**
 * 根据患者的pid和住院流水号，返回患者所有个人数据
 * @param id
 * @param lsh
 * @returns {Promise<any[]>}
 */
async function queryPatient(id, lsh) {
    const zyh = lsh.substr(7, 7);
    const home_data = db.query(`SELECT * FROM FIRST_HOME WHERE part1_pid = ${id}`);
    const advice_data = db.query(`SELECT ${advice_keys.join(',')} FROM FIRST_ADVICE WHERE part2_zyh = '${lsh}'`);
    const lis_data = db.query(`SELECT part3_sj, part3_xmmc, part3_xxmmc, part3_jg, part3_ckfw, part3_dw FROM FIRST_LIS WHERE part3_zylsh = '${lsh}'`);
    const mazui_data = db.query(`SELECT * FROM FIRST_MAZUI WHERE part4_zylsh = '${lsh}'`);
    const results_data = db.query(`SELECT * FROM FIRST_RESULTS WHERE part5_zyh = ${zyh}`);
    return await Promise.all([home_data, advice_data, lis_data, mazui_data, results_data]);
}


/**
 * ES搜索，根据输入的关键字进行配置（搜索方式，返回数量与条目）和搜索。这里我采用的方法仍需要在后面进行优化。
 * @param q 关键字
 * @returns {Promise<*>}
 */
async function elasticQuery(q) {
    let words = q.split('');
    words = words.map((word) => {
        return {
            term: {'part5_jcjgms': word}
        }
    });
    const related_zyh = [];
    const zyh_highlight = {};
    return await db.es().search({
        body: {
            highlight: {
                require_field_match: false,
                fields: {
                    "*": {}
                }
            },
            query: {
                bool: {
                    must: words
                }
            },
            from: 0,
            size: 100
        },
        '_source':[
            'part5_zyh'
        ]
    })
}

/**
 * 根据ES搜索返回的结果，来生成相关对应的住院号数组的函数
 * @param res ES返回结果
 * @returns {Array} 住院号数组
 */
function generateEsZyh(res) {
    const related_zyh = [];
    const zyh_highlight = {};
    res['hits']['hits'].forEach(item => {
        let high_light;
        related_zyh.push(item._source['part5_zyh']);
        Object.keys(item.highlight).forEach((part, index) => {
            if (index === 0) {
                high_light = item.highlight[part];
            }
        });
        zyh_highlight[item._source['part5_zyh']] = high_light;
    });
    return _.uniq(related_zyh);
}

//通过pid获取一附院病人病案首页信息
/*router.get('/oa/patient1/:pid/:zyh',async(ctx,next) => {
    let {pid, zyh} = ctx.params;

    await queryPatient(pid, zyh).then((res) => {
        const operation_time = res[0][0]['part1_ssrq'];
        const type_lis = Utils.generateCategory(res[2], 'part3_xmmc');
        type_lis.forEach(type => {
            type.data.forEach(item => {
                delete item['part3_xmmc'];
            });
            type.data = Utils.generateCategory(type.data, 'part3_sj');
            type.data.map(item => {
                item['reference'] = item.type < operation_time ? 'before' : 'after';

                return item;
            });
        });
        let i = 0;
        res[4].map(item => {
            item['no'] = i++;
            item['part5_jcsj'] = item['part5_jcsj'].substr(0, 16);
            item['part5_xb'] = gender_map[res[0][0]['part1_xb']];
            item['part5_nl'] = res[0][0]['part1_nl'];
            item['reference'] = item['part5_jcsj'] < operation_time ? '术前': '术后';
            i++;
            return item;
        });
        ctx.body = {
            ...Tips[0],
            data: {
                home: res[0],
                advice: Utils.generateAdvice(res[1]),
                lis: type_lis,
                mazui: res[3],
                results: res[4]
            }
        }
    }).catch(e => {
        ctx.body = {
            ...Tips[1002],
            error: e
        }
    })
});*/


//通过pid获取一附院病人病案首页信息
router.get('/oa/patient1/:pid/:zyh',async(ctx,next) => {
    let {pid, zyh} = ctx.params;

    await queryPatient(pid, zyh).then((res) => {
        /*const operation_time = res[0][0]['part1_ssrq'];
        const type_lis = Utils.generateCategory(res[2], 'part3_sj');
        type_lis.map(item => {
            item['reference'] = item.type < operation_time ? 'before' : 'after';
            return item;
        });
        type_lis.forEach(type => {
            type.data.forEach(item => {
                delete item['part3_sj'];
            });
            type.data = Utils.generateCategory(type.data, 'part3_xmmc');

        });*/

        const operation_time = res[0][0]['part1_ssrq'];

        let type_lis = [];
        let type_before = {
            type:"术前检查",
            data:[]
        };

        let type_after = {
            type:"术后检查",
            data:[]
        };

        type_lis.push(type_before);
        type_lis.push(type_after);
        res[2].forEach(item => {

            if(item['part3_sj'] < operation_time){
                type_lis[0].data.push(item);
            }else{
                type_lis[1].data.push(item);
            }
        });

        type_lis.forEach(type => {

            type.data = Utils.generateCategory(type.data, 'part3_xmmc');
        });

        for(let i =0;i<type_lis.length;i++){
            if(type_lis[i].data.length===0){
                type_lis.splice(i,1);
            }
        }

        /*if(type_lis[0].data.length===0){
            type_lis.splice(0,1);
        }  */

        let i = 0;
        res[4].map(item => {
            item['no'] = i++;
            item['part5_jcsj'] = item['part5_jcsj'].substr(0, 16);
            item['part5_xb'] = gender_map[res[0][0]['part1_xb']];
            item['part5_nl'] = res[0][0]['part1_nl'];
            item['reference'] = item['part5_jcsj'] < operation_time ? '术前': '术后';
            return item;
        });
        ctx.body = {
            ...Tips[0],
            data: {
                home: res[0],
                advice: Utils.generateAdvice(res[1]),
                lis: type_lis,
                mazui: res[3],
                results: res[4]
            }
        }
    }).catch(e => {
        ctx.body = {
            ...Tips[1002],
            error: e
        }
    })
});


router.post('/oa/es_list/', async (ctx, next) => {
    let {q, pageindex, pagesize} = ctx.request.body;
    const start = pageindex - 1;
    const end = start + pagesize;
    let words= q.split('');
    words = words.map((word) => {
        return {
            term: {'part5_jcjgms': word}
        }
    });
    const related_zyh = [];
    const zyh_highlight = {};
    await db.es().search({
        body: {
            highlight: {
                require_field_match: false,
                fields: {
                    "*": {}
                }
            },
            query: {
                bool: {
                    must: words
                }
            },
            from: 0,
            size: 100
        },
        '_source':[
            'part5_zyh'
        ]
    }).then(async (res)=> {
        res['hits']['hits'].forEach(item => {
            let high_light;
            related_zyh.push(item._source['part5_zyh']);
            Object.keys(item.highlight).forEach((part, index) => {
                if (index === 0) {
                    high_light = item.highlight[part];
                }
            });
            zyh_highlight[item._source['part5_zyh']] = high_light;
        });
        const uniq_zyh = _.uniq(related_zyh);
        await queryHome(uniq_zyh).then(res => {
            res.map(patient => {
                patient.highlight = zyh_highlight[patient['part1_zyh']];
                return patient;
            });
            console.log(res.length);
            ctx.body = {...Tips[0], count_num:res.length, data: res.slice(start, end)};
        }).catch(e => {
            ctx.body = {status: e}
        })
    }).catch(e => {
        console.log(e);
        console.log('es down');
    });
});

// 给郑莹倩师姐：根据字段数组获取字段值
router.get('/oa/patients1/:list',async(ctx,next) => {
    let params = ctx.params.list;
    let sql = `SELECT ${params} FROM FIRST_HOME;`;
    await db.query(sql).then((res) => {
        ctx.body = {...Tips[0],data:res};
    }).catch(e => {
        ctx.body = {...Tips[1002],error:e};
    });
});

// 病案首页筛选API中使用的去重函数
function unique (arr) {
    const seen = new Map();
    return arr.filter((a) => !seen.has(a) && seen.set(a, 1));
}

//给郑莹倩师姐：筛选基础上返回特定字段
router.post('/oa/patients1/filter',async (ctx, next) =>{
    var pagesize = parseInt(ctx.request.body.pagesize);
    var pageindex = parseInt(ctx.request.body.pageindex);
    var isAll = ctx.request.body.isAll;
    var start = pageindex -1;
    var conditions = ctx.request.body.conditions;
    var searchField = ctx.request.body.keys;
    var formType = [];
    var logicValue = [];
    var where_array = [];
    var where = ''  ;
    var set = '';
    //console.log(conditions);
    conditions.forEach(item => {
        searchField.push(item.databaseField);
        logicValue.push(item.logicValue);
        Object.keys(form).forEach( i => {
            if(i === item.form_type){
                formType.push(form[i]);
            }
        })
        //console.log(formType);

          //字符型查找
          if ((item.isNotNumber === true) && (item.isSelect === false)) {
              if (item.selectedValue === '包含') {
                  where_array.push(`(${item.databaseField} like '%${item.inputValue}%')`);
              }
              if (item.selectedValue === '等于') {
                  where_array.push(`(${item.databaseField} = '${item.inputValue}')`);
              }
          }
          //选择框查找
          if ((item.isNotNumber === true) && (item.isSelect === true)) {

              if (item.selectedInt != null) {
                  where_array.push(`(${item.databaseField} = ${item.selectedInt})`);
              }else {
                  where_array.push(`(${item.databaseField} = '${item.selectedValue}')`);
              }
          }
          //次数查找
          if (item.isNumber === true) {
              where_array.push(`(${item.databaseField} between ${item.inputValue1} and ${item.inputValue2})`);
          }
          //时间查找
          if (item.isTime === true) {
              where_array.push(`(${item.databaseField} between '${item.startTime}' and '${item.endTime}')`);
          }
    });

    //console.log(searchField);
    where_array.forEach((item, index) => {
          if ( index === where_array.length - 1) {
              where = ` ${where}${item} `;
          }else {
              where = ` ${where}${item}  ${logicValue[index + 1]} `;
          }
    });

    formType.push('FIRST_HOME');

    //if(formType.indexOf('SECOND_FEE')!=-1){
    //    where = `(part1_bah=part2_bah) and ${where}`;
    //}


    let sql1;
    let sql2;
    if((conditions.length!=0)&&(isAll===false)){
        searchField.push('part1_zyh', 'part1_xm', 'part1_rysj', 'part1_nl' , 'part1_pid');
        sql1 = `SELECT ${unique(searchField)} FROM ${unique(formType)} where ${where} limit ${start},${pagesize};`;
        sql2 = `SELECT count(1) as num from (SELECT ${unique(searchField)}  FROM ${unique(formType)} where ${where}) as temp ;`;
        // sql2 = `SELECT ${unique(searchField)}, count(1) AS num FROM ${unique(formType)} where ${where} GROUP BY ${unique(searchField)};`;
    }else if((conditions.length!=0)&&(isAll===true)){
        sql1 = `SELECT ${unique(searchField)} FROM ${unique(formType)} where ${where};`;
        sql2 = `SELECT count(1) as num from (SELECT ${unique(searchField)}  FROM ${unique(formType)} where ${where}) as temp ;`;
    }else{
        //sql1 = `SELECT part1_xm,part1_zyh,part1_rysj,part1_nl,part1_pid FROM FIRST_HOME limit ${start},${pagesize};`
        sql1 = `SELECT ${unique(searchField)} FROM FIRST_HOME limit ${start},${pagesize};`
        sql2 = 'SELECT COUNT(*) FROM FIRST_HOME;'
    }

   //console.log(sql1);
   //console.log(sql2);
    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1, part2]).then((res) => {
        //console.log(res);
        data = res[0];
        data.forEach(element => {
                Object.keys(element).forEach( item=>{
                    if (item === 'part1_xb') {
                        key = element[item];
                        if(element[item]===1){
                            element[item]='男';
                        }
                        if(element[item]===2){
                            element[item]='女';
                        };
                    }
                })
             })
        if(conditions.length!=0){
            num = res[1][0]['num'];
        }else{
            num = res[1][0]['COUNT(*)'];
        }
        //console.log(num);

        //Utils.cleanData(res);
        ctx.body = {...Tips[0],count_num:num,data:data};
        // ctx.body = {...Tips[0],data:data};

    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e}
    })
});

// 给李安：获取年龄、性别、手术名称、主诊断、民族百分比
router.get('/oa/dashboard_1',async(ctx,next) => {
    let sql = 'SELECT part1_nl,part1_xb,part1_ssmc,part1_zzd,part1_mz,part1_sjzyts,part1_xzz FROM FIRST_HOME;';
    let age = [];
    let gender = [];
    let surgery = [];
    let diagnosis = [];
    let treatDays = [];
    let provinces = [];
    let city = [];
    let shannxi = 0;
    let num1 = 0;
    let nationalityPercentage = 0;

    await db.query(sql).then(res => {
        res.forEach( element => {
            age.push(element.part1_nl);
            gender.push(element.part1_xb);
            surgery.push(element.part1_ssmc);
            diagnosis.push(element.part1_zzd);
            treatDays.push(element.part1_sjzyts);
            if(element.part1_mz === '汉族') nationalityPercentage++;
            // var reg = /.+?(省|市|自治区|自治州)/g;
            // let s = element.part1_xzz.match(reg);
            // if(s != null)
            // {
            //     let a = s[0];
            //     let b = s[1];
            //     if(a.charAt(a.length-1) === '省' || a.slice(a.length-3,a.length) === '自治区' || a === '北京市' || a === '上海市' || a === '天津市' || a === '重庆市')
            //     {
            //         provinces.push(a.replace(/\s+/g,''));
            //     }
            //     if(a.charAt(a.length-1) === '市' || a.slice(a.length-3,a.length) === '自治州')
            //     {
            //         city.push(a.replace(/\s+/g,''));
            //     }
            //     if(b != null)
            //     {
            //         if(b.charAt(b.length-1) === '市' || b.slice(b.length-3,b.length) === '自治州')
            //         {
            //             city.push(b.replace(/\s+/g,''));
            //         }
            //     }

            // }

            if(element.part1_xzz.indexOf('省')!=-1){
                let index = element.part1_xzz.indexOf('省');
                provinces.push(element.part1_xzz.slice(index-2,index));
                num1++;
            }
            if(element.part1_xzz.indexOf('陕西')!=-1){
                shannxi++;
            }
            if(element.part1_xzz.indexOf('宁夏')!=-1){
                provinces.push('宁夏');
            }
            if(element.part1_xzz.indexOf('新疆')!=-1){
                provinces.push('新疆');
            }
            if(element.part1_xzz.indexOf('市')!=-1){
                let index = element.part1_xzz.indexOf('市');
                city.push(element.part1_xzz.slice(index-2,index));
            }
        });
        let num = res.length;
        nationalityPercentage /= num;
        shannxi /= num1;
        ctx.body = {...Tips[0],age:age,gender:gender,surgery:surgery,diagnosis:diagnosis,treatDays:treatDays,provinces:provinces,city:city,
            shannxi:shannxi,nationalityPercentage:nationalityPercentage};
    }).catch((e) => {
        console.log(e);
        ctx.body = {...Tips[1002],reason:e};
    });
});






module.exports = router;
