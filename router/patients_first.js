const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const { Parser } = require('json2csv');
const fs = require('fs');
const _ = require('lodash');
const compressing = require('compressing');
const pump = require('pump');

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
    let pagesize = parseInt(ctx.request.body.pagesize);
    let pageindex = parseInt(ctx.request.body.pageindex);
    let conditions = ctx.request.body.condition;
    const condition_array = [];
    Object.keys(conditions).forEach(key => {
        if (conditions[key] !== '') {
            condition_array.push(`${basic_conditions[key]} = '${conditions[key]}'`);
        }
    });

    const condition_sql = 'WHERE ' + condition_array.join(' AND ');
    const start = (pageindex-1);
    const home_fields = ['part1_pid', 'part1_zyh', 'part1_zylsh', 'part1_xm', 'part1_xb', 'part1_nl', 'part1_zzd', 'part1_rysj', 'part1_cysj'];
    let sql1 = `SELECT ${home_fields.join(',')} FROM FIRST_HOME  limit ${start},${pagesize};`;
    let sql2 = `SELECT COUNT(*) FROM FIRST_HOME;`;
    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1, part2]).then((res) => {
        let num = res[1][0]['COUNT(*)'];
        res[0].map(item => {
            item['part1_rysj'] = item['part1_rysj'].substr(0, 16);
            item['part1_cysj'] = item['part1_cysj'].substr(0, 16);
            item['part1_xb'] = gender_map[item['part1_xb']];
            return item;
        });
        data = res[0];
        //Utils.cleanData(res);
        ctx.body = {...Tips[0], count_num: num, data: data};
    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e}
    })
});

/**
 * 根据关键字和条件，以及页码信息，进行过滤查询的函数。 该函数仅仅用于应对不同的情况
 * @param keywords
 * @param conditions
 * @param start
 * @param size
 * @returns {Promise<*>}
 */
async function dataFilter(keywords, conditions, start, size) {
    /**
     * 如果关键字和过滤对象都为0，那么如何处理。这里做了区分。
     */
    if (keywords.length === 0 && conditions.length === 0) {
       return getPagePatients(start, size);
    } else {
       return getFilterPatients(keywords, conditions, start, size);
    }
}

/**
 * 没有任何过滤的情况下，获取病人数据。
 * @param start
 * @param size
 * @returns {Promise<{count_num: *, data: any} | never>}
 */
async function getPagePatients(start, size) {
    let sql1 = `SELECT ${home_keys} FROM FIRST_HOME LIMIT ${start}, ${size}`;
    let sql2 = `SELECT COUNT(*) FROM FIRST_HOME`;
    const get_patient = db.query(sql1);
    const get_count = db.query(sql2);
    return Promise.all([get_patient, get_count]).then(res => {
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
        return {count_num:res[1][0]['COUNT(*)'] ,data:res[0]};
    }).catch(e => {
        return e
    })
}

/**
 * 存在过滤条件的情况下，获取病人数据
 * @param keywords
 * @param conditions
 * @param start
 * @param size
 * @returns {Promise<{count_num: number, data: *}>}
 */
async function getFilterPatients(keywords, conditions, start, size) {
    let home_fields = ['part1_pid', 'part1_zyh', 'part1_zylsh', 'part1_xm', 'part1_xb', 'part1_nl', 'part1_zzd', 'part1_rysj', 'part1_cysj'];
    let zyh_array = [];
    let zyh_highlight = {};
    const elastic_search_conditons = [];
    const elastic_conditions = keywords;
    const filter_conditions = conditions;
    const condition_array = [];
    const part_has_condition = ['FIRST_HOME'];
    const all_condition = [];
    const join_array = [];
    elastic_conditions.forEach( item => {
        elastic_search_conditons.push(item.name.substr(5));
    });
    if (elastic_conditions.length > 0) {
        await generateESnumber(elastic_search_conditons.join('')).then(res => {
            zyh_array = res.zyh;
            zyh_highlight = res.highlight;
        })
    }

    filter_conditions.forEach(item => {
        condition_array.push(generateCondition(item, 0));
    });

    condition_array.forEach(item => {
        condition_part[item.part].items.push(item.sql);
        home_fields.push(item.databaseField);
    });

    Object.keys(condition_part).forEach((key, index) => {
        if (condition_part[key].items.length > 0 && index > 0) {
            part_has_condition.push(`${key} ${condition_part[key].table}`);
        }
        all_condition.push(...condition_part[key].items);
    });

    home_fields = home_fields.map(item => {
        return `${item}`;
    });


    /**
     * 这里就是一系列生成inner join语句的步骤，比较繁琐，可以优化
     * @type {string}
     */
    const table_map = part_has_condition.join(',');
    const column_map = `${home_fields.join(',')}`;
    let condition_map = `${join_array.concat(all_condition).join(' and ')}`;
    if (zyh_array.length > 0 && condition_array.length > 0) {
        condition_map = `${condition_map} and part1_zyh in (${zyh_array.join(',')})`;
    } else if (zyh_array.length > 0 && condition_array.length === 0) {
        condition_map = `part1_zyh in (${zyh_array.join(',')})`;
    }
    const sql = `select ${column_map} from ${table_map} ${condition_map.length === 0 ? '' : 'where ' + condition_map}`;

    return await db.query(sql).then(res => {
        const uniq_data = Utils.uniqArray(res, 'part1_pid');
        uniq_data.forEach(item => {
            item['part1_rysj'] = item['part1_rysj'].substr(0, 16);
            item['part1_cysj'] = item['part1_cysj'].substr(0, 16);
            item['part1_xb'] = gender_map[item['part1_xb']];
            item.highlight = zyh_highlight[item['part1_zyh']];
        });
        return { count_num: uniq_data.length, data: uniq_data.slice(start, start + size)};
    }).catch(e => {
        return e;
    });
}

/**
 * 目前的ES与filter结合的API
 */
router.post('/oa/filter1', async (ctx, next) => {
    /**
     * 这里规定了所有病案首页包含的字段
     * @type {string[]}
     */
    const params = ctx.request.body;
    const start = params['pageindex'] - 1;
    const size = params['pagesize'];
    const keywords = params.keywords;
    const conditions = params.condition_search;
    /**
     * 如果参数中的条件为空数组，则直接查询数量和分页条目
     */

    const history_object = {
        text: params['history'],
        set: {
            keywords: keywords,
            conditions: conditions
        }
    };
    /**
     * 查询是否需要插入历史记录
     */
    insertHistory(history_object).then(res => {
        console.log('history operation');
    });
    await dataFilter(keywords, conditions, start, size).then(res => {
       ctx.body = {...Tips[0], count_num:res.count_num, data:res.data};
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    });
});

/**
 * 插入历史记录的函数。 会在内部判断是否需要插入新的记录。
 * @param history
 * @returns {Promise<void>}
 */
async function insertHistory(history) {
    let existed = 0;
    await db.query(`select * from FIRST_SEARCH_HISTORY where JSON_CONTAINS(history_set , '${JSON.stringify(history.set)}');`).then(res => {
        existed = res.length;
    }).catch(e => {
        console.log(e);
    });
    if (existed === 0) {
        await db.query(`insert into FIRST_SEARCH_HISTORY(history_text, history_set) values ('${history.text}', '${JSON.stringify(history.set)}');`).then(res => {
            console.log('插入历史记录');
        }).catch(e => {
            console.log('插入失败');
        })
    }
}

/**
 * 历史记录获取api
 */
router.get('/oa/history', async (ctx, next) => {
   await db.query(`select * from FIRST_SEARCH_HISTORY order by history_pid desc LIMIT 25;`).then(res => {
       ctx.body = {...Tips[0], data: res}
   }).catch(e => {
       ctx.body = {...Tips[1002], e}
   })
});

/**
 * 这里可以根据条件对象，生成条件的sql语句。 其中，type参数取值决定是单表语句，还是跨多表的语句。
 * @param condition
 * @param type
 * @returns {{databaseField: *, part: *, sql: string}}
 */
function generateCondition(condition, type) {
    const table_map = {
        'part1': 'a',
        'part2': 'b',
        'part3': 'c',
        'part4': 'd',
        'part5': 'e'
    };
    if (condition['isNumber'] === true ) {
        const result = {
            databaseField: condition['databaseField'],
            part: part_map[condition['databaseField'].split('_')[0]],
            sql: `${type === 0 ? '' : table_map[condition['databaseField'].split('_')[0]] + '.'}${condition['databaseField']} between ${condition['inputValue1']} and ${condition['inputValue2']}`
        };
        return result;
    }
    if ((condition['isNotNumber']===true)&&(condition['isSelect']==true)) {
        if (condition['databaseField'] === 'part1_xb') {
            const result = {
                databaseField: condition['databaseField'],
                part: part_map[condition['databaseField'].split('_')[0]],
                sql: `${type === 0 ? '' : table_map[condition['databaseField'].split('_')[0]] + '.'}${condition['databaseField']} = ${condition['selectedInt']}`
            };
            return result;
        }else{
            const result = {
                databaseField: condition['databaseField'],
                part: part_map[condition['databaseField'].split('_')[0]],
                sql: `${type === 0 ? '' : table_map[condition['databaseField'].split('_')[0]] + '.'}${condition['databaseField']}  = ${condition['selectedValue']}`
                // sql: `${table_map[condition['databaseField'].split('_')[0]]}.${condition['databaseField']} like '%${condition['inputValue']}%'`
            };
            return result;
        }
    }
    if ((condition['isNotNumber']===true)&&(condition['isSelect']===false)) {
        if (condition['selectedValue'] === '包含') {
            const result = {
                databaseField: condition['databaseField'],
                part: part_map[condition['databaseField'].split('_')[0]],
                sql: `${type === 0 ? '' : table_map[condition['databaseField'].split('_')[0]] + '.'}${condition['databaseField']} like '%${condition['inputValue']}%'`
            };
            return result;
        }
        if(condition['selectedValue'] === '等于') {
            const result = {
                databaseField: condition['databaseField'],
                part: part_map[condition['databaseField'].split('_')[0]],
                sql: `${type === 0 ? '' : table_map[condition['databaseField'].split('_')[0]] + '.'}${condition['databaseField']}  = ${condition['inputValue']}`
            };
            return result;
        }
    }
    if (condition['isTime'] === true) {
        const result = {
            databaseField: condition['databaseField'],
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
 * elasticSearch关键字查询函数。 里面制定了查询的方法，高亮配置，大小等信息。
 * @param q
 * @param index
 * @returns {Promise<*>}
 */
async function elasticTesting(q, index) {
    console.log(q);
    return await db.es().search({
        index: index,
        body: {
            query: {
                query_string: {
                   query: q
                }
            },
            highlight: {
                order: 'score',
                number_of_fragments: 2,
                fields: {
                    "*": {}
                }
            },
            from: 0,
            size: 100
        },
        _source:[
            'part5_zyh'
        ]
    });
}

/**
 * 根据查询关键字q和查询的field，来生成住院号。
 * @param q
 * @param index
 * @returns {Promise<{highlight, zyh: Array}>}
 */
async function generateESnumber(q, index) {
    const related_zyh = [];
    const zyh_highlight = {};
    let zyh_array = [];
    await elasticTesting(q, index).then(res => {
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
    return {zyh: zyh_array, highlight: zyh_highlight};
}


/**
 * 测试api，无用
 */
router.get('/oa/test_es/:q', async (ctx, next) => {
    let {q} = ctx.params;
    await generateESnumber(q, 'first_results').then(res => {
        ctx.body = res;
    });
});


/**
 * （旧）根据ES搜索返回的结果，来生成相关对应的住院号数组的函数
 * @param res ES返回结果
 * @returns {Array} 住院号数组
 */
function generateEsZyh(res) {
    const related_zyh = [];
    res['hits']['hits'].forEach(item => {
        related_zyh.push(item._source['part5_zyh']);
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
    let pagesize = parseInt(ctx.request.body.pagesize);
    let pageindex = parseInt(ctx.request.body.pageindex);
    let isAll = ctx.request.body.isAll;
    let start = pageindex -1;
    let conditions = ctx.request.body.conditions;
    let searchField = ctx.request.body.keys;
    let formType = [];
    let logicValue = [];
    let where_array = [];
    let where = ''  ;
    let set = '';
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
            // let reg = /.+?(省|市|自治区|自治州)/g;
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

/**
 * POST：向导出数据规则表 FIRST_EXPORTRULE 中新增一条规则
 * @param {name,rule,user} 规则名称，规则内容，规则创建者
 * @returns {pid} 规则pid
 */
router.post('/oa/patients1/exportrule/insert',async(ctx,next) => {
    let name = ctx.request.body.name;
    let rule = JSON.stringify(ctx.request.body.rule);
    let user = ctx.request.body.user;
    //console.log(JSON.stringify(rule));

    let sql = 'INSERT ' +
              'INTO FIRST_EXPORTRULE (part6_name,part6_rule,part6_createUser) ' +
              `VALUES ('${name}','${rule}','${user}');`
    await db.query(sql).then(res => {
        ctx.body = {...Tips[0],status:"插入成功",pid:res['insertId']};
    }).catch(e => {
        ctx.body = {...Tips[1],status:"插入失败",reason:e};
    });
});

/**
 * DELETE：删除导出数据规则表 FIRST_EXPORTRULE 中的规则
 * @param {pid} 规则pid
 * @returns {status} 操作状态
 */
 router.delete('/oa/patients1/exportrule/delete/:pid',async(ctx,next) => {
     let params = ctx.params;
     let {pid} = params;
     let sql = `SELECT * FROM FIRST_EXPORTRULE WHERE part6_pid=${pid};`

     await db.query(sql).then(async res => {
        if(!res.length) ctx.body = {...Tips[1],status:"删除失败",reason:'没有对应的记录'};
        else {
            let sql2 = `DELETE FROM FIRST_EXPORTRULE WHERE part6_pid=${pid};`
            await db.query(sql2).then(res2 => {
                console.log(res2);
                if(res2['affectedRows']) ctx.body = {...Tips[0],status:"删除成功",data:res};
                else ctx.body = {...Tips[1],status:"删除失败",reason:"操作未成功"};
            }).catch(e => {
                ctx.body = {...Tips[1],status:"删除失败",reason:e}
            });
        }
     }).catch(e => {
        ctx.body = {...Tips[1],status:"删除失败",reason:e};
     });
 });

 /**
 * PUT：修改导出数据规则表 FIRST_EXPORTRULE 中的规则
 * @param {pid,name,rule,user} 规则pid
 * @returns {data} 修改前数据
 */
router.put('/oa/patients1/exportrule/update',async(ctx,next) => {
    let pid = ctx.request.body.pid;
    let name = ctx.request.body.name;
    let rule = JSON.stringify(ctx.request.body.rule);
    let user = ctx.request.body.user;
    //console.log(JSON.stringify(rule));

    let sql  = `SELECT * FROM FIRST_EXPORTRULE WHERE part6_pid=${pid};`

    await db.query(sql).then(async res => {
        if(!res.length) ctx.body = {...Tips[1],status:"更新失败",reason:"没有找到相关记录"};
        else {
            let sql2 = 'UPDATE FIRST_EXPORTRULE ' +
            `SET part6_name='${name}',part6_rule='${rule}',part6_updateUser='${user}' ` +
            `WHERE part6_pid=${pid};`
            await db.query(sql2).then(res2 => {
                if(res2['affectedRows']) ctx.body = {...Tips[0],status:"更新成功",dataInit:res};
                else ctx.body = {...Tips[1],status:"更新失败",reason:"操作未成功"};
            }).catch(e => {
                ctx.body = {...Tips[1],status:"更新失败",reason:e};
            });
        }
    }).catch(e => {
        ctx.body = {...Tips[1],status:"更新失败",reason:e};
    });
});

 /**
 * GET：查看导出数据规则表 FIRST_EXPORTRULE 中的规则
 * @param {pid} 规则pid
 * @returns {data} 规则内容
 */
router.get('/oa/patients1/exportrule/get/:pid',async(ctx,next) => {
    let params = ctx.params;
    let {pid} = params;
    let sql = `SELECT * FROM FIRST_EXPORTRULE WHERE part6_pid=${pid};`;
    await db.query(sql).then(res => {
        if(!res.length) ctx.body = {...Tips[1],status:"查找失败",reason:"没有找到相应记录"};
        else ctx.body = {...Tips[0],status:"查找成功",data:res};
    }).catch(e => {
        ctx.body = {...Tips[1],status:"查找失败",reason:e};
    });
});

 /**
 * GET：查看导出数据规则表 FIRST_EXPORTRULE 中的所有规则
 * @param  无
 * @returns {data} 规则内容
 */
router.get('/oa/patients1/exportrule/getall',async(ctx,next) => {
    let sql = `SELECT * FROM FIRST_EXPORTRULE;`;
    await db.query(sql).then(res => {
        if(!res.length) ctx.body = {...Tips[1],status:"查找失败",reason:"没有找到相应记录"};
        else ctx.body = {...Tips[0],status:"查找成功",length:res.length,data:res};
    }).catch(e => {
        ctx.body = {...Tips[1],status:"查找失败",reason:e};
    });
});

 /**
 * GET：根据导出数据规则表 FIRST_EXPORTRULE 中的规则导出数据
 * @param  {pid} 规则pid
 * @returns {.csv} 导出数据
 */


router.get('/oa/patients1/exportdata/:pid',async(ctx,next) => {
    let params = ctx.params;
    let {pid} = params;
    let sql1 = `SELECT part6_rule FROM FIRST_EXPORTRULE WHERE part6_pid=${pid};`;
    let data = [];
    let fields = [];
    await db.query(sql1).then(async res => {
        if(!res.length) ctx.body = {...Tips[1],status:"查找失败",reason:"没有找到相应记录"};
        else{
            let jsonString = res[0]['part6_rule'];
            let rule = JSON.parse(jsonString);
           for(let element in rule){
                let sql2 = `SELECT ${rule[element].join(',')} FROM ${element};`
                fields = fields.concat(rule[element]);
                await db.query(sql2).then(res2 =>{
                    //data[element] = res2;
                    data = data.concat(res2);
                }).catch(e => {
                    ctx.body = {...Tips[1],status:"数据查找失败",reason:e};
                });
           }
        }
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);
        ctx.set('Content-disposition','attachment;filename=data.csv');
        ctx.statusCode = 200;
        ctx.body = csv;
        //ctx.body = {...Tips[0],status:"查找成功",data:data};
    }).catch(e => {
        ctx.body = {...Tips[1],status:"规则查找失败",reason:e};
    });
});

function generateWhere(tableName,patients,isAll){
    let table = {
        FIRST_HOME:"part1_zylsh",
        FIRST_ADVICE:"part2_zyh",
        FIRST_LIS:"part3_zylsh",
        FIRST_MAZUI:"part4_zylsh",
        FIRST_RESULTS:"part5_zyh"
    }
    let where = '';
    if(tableName.length === 1) return where;
    // for(let i in tableName){
    //    if(i % 2) where += '=' + table[tableName[i]] + ' AND ';
    //    else where += table[tableName[i]];
    //    i--;
    // }
    let flag = false;
    for(let i = 0;i < tableName.length;i++)
    {
        if(tableName[i] === 'FIRST_RESULTS'){
            tableName.splice(i,1);
            flag = true;
            break;
        }
    }
    if(flag){
        tableName.push('FIRST_RESULTS');
        //let temp = tableName[tableName.length-2];
        //tableName[tableName.length-2] = `RIGHT(${temp},7)`;
    }
    for(let i = 0;i < tableName.length-1;i++)
    {
        //if(i % 2) where += '=' + table[tableName[i]] + ' AND ';
        //else where += table[tableName[i]];
        if(flag && i === tableName.length-2){
            where += `RIGHT(${table[tableName[i]]},7)` + '=' + table[tableName[i+1]] + ' AND ';
        }else{
            where += table[tableName[i]] + '=' + table[tableName[i+1]] + ' AND ';
        }
    }
    if(isAll) return where.slice(0,-5) + ';';
    else{
        let temp = patients.map(element => {return `"${element}"`;});
        where += `${table[tableName[0]]} in (${temp});`;
        return where;
    }
}

router.post('/oa/patients1/exportdata2/test',async(ctx,next) => {
    let ruleId = ctx.request.body.ruleId;
    let patients = ctx.request.body.patients;
    let isAll = ctx.request.body.isAll;
    let sql1 = `SELECT part6_rule FROM FIRST_EXPORTRULE WHERE part6_pid=${ruleId};`;

    let data = [];
    let fields = [];

    let tip = 0;
    let status = '';
    let reason = '';

    await db.query(sql1).then(async res => {
        if(!res.length) ctx.body = {...Tips[1],status:"查找失败",reason:"没有对应的规则记录"};
        else{
            let jsonString = res[0]['part6_rule'];
            let rule = JSON.parse(jsonString);
            let tableName = [];
            let keyName = [];
            let sql2 = '';

            for(let element in rule){
                tableName.push(element);
                keyName = keyName.concat(keyName,rule[element]);
            }
            fields = keyName;
            let where = generateWhere(tableName,patients,isAll);
            sql2 = `SELECT ${keyName.join(',')} FROM ${tableName.join(',')} WHERE ${where}`;
            //console.log(sql2);
            await db.query(sql2).then(res2 => {
                data = res2;
            }).catch(e => {
                ctx.body = {...Tips[1],status:"数据查找失败",reason:e};
            });
        }
        console.log(fields);
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);
        ctx.set('Content-disposition','attachment;filename=data.csv');
        ctx.statusCode = 200;
        ctx.body = csv;

    }).catch(e => {
        ctx.body = {...Tips[1],status:"规则查找失败",reason:e};
    });
});

// lis/advice 如何拼接
// 如果只查lis/advice呢
// results好像也是单人多条信息？

const exportKeyTable = {
    FIRST_HOME:{
        key:"part1_zylsh",
        time:"part1_rysj"// 入院时间
    },
    FIRST_ADVICE:{
        key:"part2_zyh",
        time:"part2_kssj"// 开始时间
    },
    FIRST_LIS:{
        key:"part3_zylsh",
        time:"part3_sj"  // 时间
    },
    FIRST_MAZUI:{
        key:"part4_zylsh",
        time:"part4_ssrq"// 手术日期
    },
    FIRST_RESULTS:{
        key:"part5_zyh",
        time:"part5_jcsj"// 检查时间
    }
}

function dataConcat(data,res)
{
    
}
router.post('/oa/patients1/exportdata2/test2',async(ctx,next) => {
    let ruleId = ctx.request.body.ruleId;
    let patients = ctx.request.body.patients;
    let isAll = ctx.request.body.isAll;
    let sql1 = `SELECT part6_rule FROM FIRST_EXPORTRULE WHERE part6_pid=${ruleId};`;

    let data = [];
    let fields = [];
    
    await db.query(sql1).then(async res => {
        if(!res.length) ctx.body = {...Tips[1],status:"查找失败",reason:"没有对应的规则记录"};
        else{
            let jsonString = res[0]['part6_rule'];
            let rule = JSON.parse(jsonString);

            for(let element in rule){
                let sql2 = '';
                if(element != "FIRST_LIS"){
                    //if(!(table[element] in rule[element])) rule[element].unshift(table[element]);
                    //fields = fields.concat(rule[element]);
                    //if(!(exportKeyTable[element].time in rule[element])) rule[element].unshift(exportKeyTable[element].time);
                    rule[element].unshift(exportKeyTable[element].time);
                    rule[element].unshift(exportKeyTable[element].key);

                    if(isAll) sql2 = `SELECT ${rule[element].join(',')} FROM ${element};`;
                    else{
                        if(element == 'FIRST_RESULTS'){
                            let zyh = patients.map(element => {return element.substring(7);});
                            sql2 = `SELECT ${rule[element].join(',')} FROM ${element} WHERE ${exportKeyTable[element].key} in (${zyh.join(',')});`;
                        }
                        else{
                            let zylsh = patients.map(element => {return `"${element}"`;});
                            sql2 = `SELECT ${rule[element].join(',')} FROM ${element} WHERE ${exportKeyTable[element].key} in (${zylsh});`;
                        } 
                    }
                }
                else{
                    let where = '';
                    rule[element].forEach(e => {
                        let xxmmc = e['part3_xxmmc'].map(element => {return `"${element}"`;});
                        where += `part3_xmmc="${e['part3_xmmc']}" AND part3_xxmmc in (${xxmmc.join(',')}) OR `;
                    })
                    where = where.slice(0,-4);
                    let temp = ["part3_zylsh","part3_zycs","part3_xmmc","part3_xxmmc","part3_sj","part3_jg","part3_ckfw","part3_dw"];
                    
                    //fields = fields.concat(temp);
                    
                    if(isAll) sql2 = `SELECT ${temp.join(',')} FROM ${element} WHERE ${where};`;
                    else{
                        let zylsh = patients.map(element => {return `"${element}"`;});
                        sql2 = `SELECT ${temp.join(',')} FROM ${element} WHERE ${exportKeyTable[element].key} in (${zylsh}) AND (${where});`;
                    }
                }
                //console.log(sql2);
                await db.query(sql2).then(res2 => {
                    //console.log(sql2);
                    //let lisTable = ['FIRST_LIS','FIRST_ADVICE','FIRST_RESULTS'];
                    //if(lisTable.includes(element)) res2 = Utils.generateCategory(res2,table[element]);
                    //console.log(res2);
                    let res3 = [];
                    if(element === 'FIRST_HOME'){
                        res2.forEach(e => {
                            //let temp = {};
                            //temp['zylsh'] = e[exportKeyTable[element].key];
                            //delete e[exportKeyTable[element].key];
                            //temp['data'] = e;
                            let temp = e;
                            temp['zylsh'] = e[exportKeyTable[element].key];
                            delete temp[exportKeyTable[element].key];
                            res3.push(temp);
                        })
                    }
                    else if(element === 'FIRST_MAZUI' || element === 'FIRST_RESULTS'){
                        res2 = Utils.generateCategory(res2,exportKeyTable[element].key);
                        res2.forEach(e => {
                            let temp = {};
                            if(element === 'FIRST_MAZUI') temp['zylsh'] = e.type;
                            else temp['zyh'] = e.type.toString();
                            e.data.forEach(ee => {delete ee[exportKeyTable[element].key];});

                            if(e.data.length === 1) {
                                //temp['data'] = e.data[0];
                                temp = Object.assign(temp,e.data[0]);
                            }
                            else{
                                let temp2 = {};
                                e.data.forEach(e2 => {

                                    let time = e2[exportKeyTable[element].time];
                                    delete e2[exportKeyTable[element].time];
                                    Object.keys(e2).forEach(e3 => {
                                        e2[e3] = time + ' : ' + e2[e3];
                                        if(e3 in temp2) temp2[e3].push(e2[e3]);
                                        else{
                                            temp2[e3] = [e2[e3]];
                                        }
                                    })
                                })
                                //temp['data'] = temp2;
                                temp = Object.assign(temp,temp2);
                            }
                            res3.push(temp);
                        })
                    }
                    else if(element === 'FIRST_LIS'){
                        res2 = Utils.generateCategory(res2,exportKeyTable[element].key);
                        res2.forEach(e => {
                            let temp = {};
                            temp['zylsh'] = e.type;
                            e.data.forEach(e => {
                                delete e[exportKeyTable[element].key];
                                let key = `${e['part3_xmmc']} ${e['part3_xxmmc']} (单位 : ${e['part3_dw']})`;
                                if(key in temp) temp[key].push(e['part3_sj'] + ' : ' + e['part3_jg']);
                                else temp[key] = [e['part3_sj'] + ' : ' + e['part3_jg']];
                            });
                            res3.push(temp);
                        })
                    }
                    //console.log(res3);
                    if(!data.length) data = res3;
                    else{
                        for(let i in res3)
                        {
                            let flag = false;
                            for(let j in data)
                            {
                                if(element != 'FIRST_RESULTS'){
                                    if('zylsh' in data[j]){
                                        if(data[j]['zylsh'] === res3[i]['zylsh']){
                                            data[j] = Object.assign(data[j],res3[i]);
                                            flag = true;
                                        }
                                    }
                                    else if('zyh' in data[j]){
                                        if(data[j]['zyh'] === res3[i]['zylsh'].slice(7)){
                                            data[j] = Object.assign(data[j],res3[i]);
                                            flag = true;
                                        }
                                    }
                                }
                                else{
                                    if('zylsh' in data[j]){
                                        if(data[j]['zylsh'].slice(7) === res3[i]['zyh']){
                                            data[j] = Object.assign(data[j],res3[i]);
                                            flag = true;
                                        }
                                    }
                                    else if('zyh' in data[j]){
                                        if(data[j]['zyh'] === res3[i]['zyh']){
                                            data[j] = Object.assign(data[j],res3[i]);
                                            flag = true;
                                        }
                                    }
                                }
                            }
                            if(!flag) data.push(res3[i]);
                        }
                    }
                    //console.log(data);
                }).catch(e => {
                    ctx.body = {...Tips[1],status:"数据查找失败",reason:e};
                })
            }
        }
        //console.log(data);
        data.forEach(e => {
            fields = fields.concat(Object.keys(e));
        })
        fields = _.uniq(fields);
        //console.log(fields);
        
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);
        console.log(typeof(csv));
        let buffer = Buffer.from(csv,'utf8');
        

        /*
        compressing.zip.compressFile(buffer,'data.zip').then(() =>{
            //console.log('enter');
            //ctx.set('Content-disposition','attachment;filename=data.csv');
            //ctx.statusCode = 200;
            //ctx.body = 'data.zip';
            console.log('success');
        }).catch(e => {
            ctx.body = {...Tips[1],status:"压缩失败",reason:e};
        });*/

        
        console.log('a');
        fs.writeFile('data.csv',csv,function(err){
            if(err) console.log(err);
        });
        console.log('b');
        //compressing.zip.compressFile('data.csv','data.zip')
        //.then(compressDone)
        //.catch(handleError);

        const source = fs.createReadStream('data.csv');
        const target = fs.createWriteStream('data.zip');
        console.log('bb');
        pump(source,new compressing.zip.FileStream(),target,err => {
            if(err) console.log(err);
            else{
                console.log('success');
            }
        });
        console.log('c');

        /*
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);
        ctx.set('Content-disposition','attachment;filename=data.csv');
        ctx.statusCode = 200;
        ctx.body = csv;
        //console.log('enter1');
        //ctx.body = {...Tips[0],status:"查找成功",data:data};
        //console.log('enter2');
        */

    }).catch(e => {
        ctx.body = {...Tips[1],status:"规则查找失败",reason:e};
    });
});
module.exports = router;
