const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const fs = require('fs');
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

// 一附院和二附院所有表单字段的map
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

    //console.log(data);
    return data;
    //return {'检查项目' : data};
}



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

async function dataFilter(keywords, conditions, start, size) {
    if (keywords.length === 0 && conditions.length === 0) {
       return getPagePatients(start, size);
    } else {
       return getFilterPatients(keywords, conditions, start, size);
    }
}

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

    await dataFilter(keywords, conditions, start, size).then(res => {
       ctx.body = {...Tips[0], count_num:res.count_num, data:res.data};
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    });
});

/**
 * 这是我实现的，根据你规定的从前端传来的条件对象，生成条件语句的函数
 * @param condition 条件对象
 * @returns {{part: *, sql: string}} 该条件语句包含哪个part的表，对于的sql是什么
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

router.get('/oa/test_es/:q', async (ctx, next) => {
    let {q} = ctx.params;
    await generateESnumber(q, 'first_results').then(res => {
        ctx.body = res;
    });
});

/**
 * ES搜索，根据输入的关键字进行配置（搜索方式，返回数量与条目）和搜索。这里我采用的方法仍需要在后面进行优化。
 * @param q 关键字
 * @returns {Promise<*>}
 */
async function elasticQuery(q) {
    console.log(q);
    // let words = q.split('');
    let words = q;
    console.log("words", words);
    words = words.map((word) => {
        return {
            term: {'part5_jcjgms': word}
        }
    });
    console.log("words", words);
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






module.exports = router;
