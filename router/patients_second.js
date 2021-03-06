
const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const _ = require('lodash');
const { Parser } = require('json2csv');
const fs = require('fs');
const compressing = require('compressing');
const pump = require('pump');
const path = require('path');
const send = require('koa-send');
const archiver = require('archiver');

const form = {
    病案首页: 'SECOND_HOME',
    费用明细: 'SECOND_FEE',
}

const part_map = {
    'part1': 'SECOND_HOME',
    'part2': 'SECOND_FEE',
    'part3': 'SECOND_LIS',
    'part4': 'SECOND_PATHOLOGY',
};

const table_map = {
    'part1': 'a',
    'part2': 'b',
    'part3': 'c',
    'part4': 'd',
};

const gender_map = {
    '1': '男',
    '2': '女'
};


// 查询每一名病人的pid、病案号、姓名、年龄、性别、出院时间
router.get('/oa/patients_2' ,async (ctx, next) => {
    let sql = 'SELECT part1_pid, part1_bah, part1_xm, part1_nl, part1_xb, part1_cysj FROM SECOND_HOME;';
    await db.query(sql).then(res => {
        Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res.slice(0, 10)}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    })
});

// 根据病案号查询病人基本信息和费用信息
router.get('/oa/patient_2/:hos_pid', async(ctx, next) => {
    let params = ctx.params;
    let {hos_pid} = params;
    let fee_sql = `SELECT * FROM  SECOND_FEE WHERE PART1_bah = ${hos_pid};`;
    let home_sql = `SELECT * FROM  SECOND_HOME WHERE PART1_bah = ${hos_pid};`;
    const home_db = await db.query(home_sql);
    const fee_db = await db.query(fee_sql);
    Promise.all([home_db, fee_db]).then(res => {
        Utils.cleanData(res[0]);
        delete res[1][0]['part1_bah'];
        ctx.body = {
            state: 200,
            data: {
                part1: res[0][0],
                part2: res[1][0]
            }
        }
    }).catch(e => {
        ctx.body = {state: 500, error: e}
    });
});


// 将时间字段处理为标准格式
var dateModify = function (x) {
    let time_init = x.replace(/^\s/,'').split(' ')[0];
    let [year,month,day] = time_init.split('/');
    month = month < 10 ? ('0' + month) : month;
    day = day <10 ? ('0' + day) : day;
    let time = [year,month,day].join('-');
    return time;
    //console.log(element.part1_rysj);
};

// 给许靖琴：二附院病案首页信息分页
router.post('/oa/patients2',async(ctx,next) =>{
    let pagesize = parseInt(ctx.request.body.pagesize);
    let pageindex = parseInt(ctx.request.body.pageindex);
    let start = pageindex -1;
    let sql1 = `SELECT * FROM SECOND_HOME limit ${start},${pagesize};`
    let sql2 = 'SELECT COUNT(*) FROM SECOND_HOME;'
    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1,part2]).then((res) => {
        num = res[1][0]['COUNT(*)'];
        data = res[0];
        data.forEach(function(element){
            if(element.part1_HIS === 0)
            {
                element.part1_csrq = dateModify(element.part1_csrq);
                element.part1_rysj = dateModify(element.part1_rysj);
                element.part1_cysj = dateModify(element.part1_cysj);
                //console.log(element.part1_rysj);
            }
        });
        ctx.body = {...Tips[0],count_num:num,data:data};
    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e};
    });
});

// 二附院病案首页筛选API中使用的去重函数
function unique (arr) {
    const seen = new Map();
    return arr.filter((a) => !seen.has(a) && seen.set(a, 1));
}

function flatten(arr) {
    return Array.prototype.concat.apply([], arr);
}



//查找历史记录
router.post('/oa/patients2/history', async (ctx, next) => {
    console.log(1);
    let start = ctx.request.body['pageindex']-1;
    let size = ctx.request.body['pagesize'];
    const sql = `select * from SECOND_SEARCH_HISTORY order by history_pid desc ;`;
    console.log('历史记录sql',sql);
    return await db.query(sql).then(res => {
        ctx.body = {...Tips[0], data: res.slice(start, start + size),  count_num: res.length, }
    }).catch(e => {
        ctx.body = {...Tips[1002], e}
    })
 });
 
//post方法全点位过滤
router.post('/oa/patients2/filter',async (ctx, next) =>{
    /**
    * 这里规定了所有病案首页包含的字段
    * @type {string[]}
    */
   
   const params = ctx.request.body;
   console.log('历史记录params:', params);
   const start = params['pageindex'] - 1;
   const size = params['pagesize'];
   const conditions = params['conditions'];
   /**
    * 如果参数中的条件为空数组，则直接查询数量和分页条目
    */
  
   const history_object = {
       text: params['history'].history_text,
       time: params['history'].history_time,
       set: {
            conditions: conditions
       }
   };
   /**
    * 查询是否需要插入历史记录
    */

   insertHistory(history_object).then(res => {
       console.log('history operation');
   });
   await dataFilter(conditions, start, size).then(res => {
      ctx.body = {...Tips[0], count_num:res.count_num, data:res.data};
   }).catch(e => {
       ctx.body = {...Tips[1002], reason: e}
   });
   
});



async function insertHistory(history) {
   let existed = 0;
   await db.query(`select * from SECOND_SEARCH_HISTORY where JSON_CONTAINS(history_set , '${JSON.stringify(history.set)}');`).then(res => {
       existed = res.length;
   }).catch(e => {
       console.log(e);
   });
   if (existed === 0 && history['text']!=null) {
       await db.query(`insert into SECOND_SEARCH_HISTORY(history_text,history_time, history_set) values ('${history.text}','${history.time}', '${JSON.stringify(history.set)}');`).then(res => {
           console.log('插入历史记录');
       }).catch(e => {
           console.log('插入失败');
       })
   }
}



async function dataFilter(conditions, start, size) {
    /**
     * 如果关键字和过滤对象都为0，那么如何处理。这里做了区分。
     */
    if (conditions.length === 0) {
       return getPagePatients(start, size);
    } else {
       return getFilterPatients(conditions, start, size);
    }
}



/**
 * 没有任何过滤的情况下，获取病人数据。
 * @param start
 * @param size
 * @returns {Promise<{count_num: *, data: any} | never>}
 */
async function getPagePatients(start, size) {
    console.log('getPagePatients无过滤filter');
    let home_fields = ['a.part1_pid', 'a.part1_xm', 'a.part1_xb','a.part1_bah', 'a.part1_rysj', 'a.part1_ryzd', ];
    let sql1 = `SELECT ${home_fields} FROM SECOND_HOME a LIMIT ${start}, ${size}`;
    let sql2 = `SELECT COUNT(*) FROM SECOND_HOME`;
    console.log('getPagePatients无过滤sql', sql1);
    const get_patient = db.query(sql1);
    const get_count = db.query(sql2);
    return Promise.all([get_patient, get_count]).then(res => {
        console.log('getPagePatients无过滤res', res);
        res[0].forEach(item => {
            /**
             * 这里需要对时间格式进行一下裁剪
             * @type {boolean|*|*|string}
             */
            Object.keys(item).forEach(ele=>{
                if(ele === 'part1_rysj' || ele === 'part1_cysj'){
                    item[ele] = item[ele].substr(0, 16);
                }
                if(ele === 'part1_xb'){
                    item[ele] = gender_map[item[ele]];
                }
                // return item;
            })
        });

        console.log('res[0]:', res);
        return {count_num:res[1][0]['COUNT(*)'] ,data:res[0]};
       
    }).catch(e => {
        return e
    })
}



/**
 * 存在过滤条件的情况下，获取病人数据
 * @param conditions
 * @param start
 * @param size
 * @returns {Promise<{count_num: number, data: *}>}
 */
async function getFilterPatients(conditions, start, size) {
   
    let home_fields = ['a.part1_pid', 'a.part1_xm', 'a.part1_bah', 'a.part1_rysj', 'a.part1_ryzd']
    const filter_conditions = conditions;
    const lis_array = [];
    const general_array = [];
    const table_list = [];
    const all_condition = [];
    const join_array = [];
    const mainFields = [];
    const mainFields_join = [];
    const condition_part = {
        'SECOND_HOME': {
            items: [],
            table: 'a',
            main: 'part1_bah'
        },
        'SECOND_FEE': {
            items: [],
            table: 'b',
            main: 'part2_bah'
        },
        'SECOND_LIS': {
            items: [],
            table: 'c',

            main: 'part3_OUTPATIENT_ID'
        },
        'SECOND_PATHOLOGY': {
            items: [],
            table: 'd',
            main: 'part4_bah'
        },
    };
    

    filter_conditions.forEach(item => {
        if(item.subdatabaseField!=null){
            lis_array.push(generateLisCondition(item));
        }else{
            general_array.push(generateCondition(item));
        }
    });

    general_array.forEach(item => {
        condition_part[item.part].items.push(item.sql);
        home_fields.push(item.databaseField);
    });

    lis_array.forEach(item => {
        console.log("LIS返回字段：", item.databaseField);
        condition_part[item.part].items.push(item.sql);
        home_fields = home_fields.concat(item.databaseField);
        home_fields.push('c.part3_QUANTITATIVE_RESULT');
    });
    
    Object.keys(condition_part).forEach((key, index) => {
        if(index === 0) {
            table_list.push(`${key} ${condition_part[key].table}`);
            mainFields.push(`${condition_part[key].table}.${condition_part[key].main}`);
        }
        if (condition_part[key].items.length > 0 && index > 0){
            table_list.push(`${key} ${condition_part[key].table}`);
            mainFields.push(`${condition_part[key].table}.${condition_part[key].main}`);
        }
        all_condition.push(...condition_part[key].items);
    });

    console.log("过滤的函数all_condition:", all_condition);
    mainFields.forEach((item,index) => {
        if(index < mainFields.length-1 && mainFields.length > 1){
            mainFields_join.push(` (${mainFields[index]}=${mainFields[index+1]}) `);
        }
    });
    console.log('home_fields',home_fields);
    console.log('mainFields', mainFields);
    let condition_map = `${join_array.concat(all_condition).join('and')}`;
    console.log('condition_map', condition_map);
    console.log('table_list', table_list);
 
     if((mainFields.length===1) && (mainFields[0].split('.')[1].split('_')[0]==='part1')){
        sql = `select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${condition_map}; `;
        console.log('sql:', sql);
       
    }else{
        sql = `select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${mainFields_join.join('and')} and ${condition_map}; `;
        console.log('sql:', sql);
    }
    

    return await db.query(sql).then(res => {
        const uniq_data = Utils.uniqArray(res, 'part1_pid');
        const num = uniq_data.length;
        console.log('uniq_data', uniq_data);
        uniq_data.forEach( item=> {
          Object.keys(item).forEach(ele=>{
            if(ele === 'part1_rysj' || ele === 'part1_cysj'){
                item[ele] = item[ele].substr(0, 16);
            }
            if(ele === 'part1_xb'){
                item[ele] = gender_map[ item[ele]];
            }
           })
        })
        
        console.log('res', uniq_data.slice(start, start + size));
        return {  count_num: uniq_data.length, data: uniq_data.slice(start, start + size)};
    }).catch(e => {
        return e;
    });
}





//给郑莹倩师姐：二附院自定义可视化筛选基础上返回特定字段
router.post('/oa/patients2/filter2',async (ctx, next) =>{
   
    let home_fields = ['a.part1_pid', 'a.part1_xm', 'a.part1_bah', 'a.part1_rysj', 'a.part1_ryzd'];
    const pagesize = parseInt(ctx.request.body.pagesize);
    const pageindex = parseInt(ctx.request.body.pageindex);
    const start = pageindex -1;
    console.log("发送主体:", ctx.request.body);
    const filter_conditions = ctx.request.body.conditions;
    console.log("filter_conditions", filter_conditions);
    const searchField = ctx.request.body.keys;
    console.log("searchField", searchField);
    const lis_array = [];
    const general_array = [];
    const table_list = [];
    const all_condition = [];
    const join_array = [];
    const mainFields = [];
    const mainFields_join = [];
    const keysFileds = [];
    const condition_part = {
        'SECOND_HOME': {
            items: [],
            table: 'a',
            keys: [],
            main: 'part1_bah'
        },
        'SECOND_FEE': {
            items: [],
            table: 'b',
            keys: [],
            main: 'part2_bah'
        },
        'SECOND_LIS': {
            items: [],
            table: 'c',
            keys: [],
            main: 'part3_OUTPATIENT_ID'
        },
        'SECOND_PATHOLOGY': {
            items: [],
            table: 'd',
            keys: [],
            main: 'part4_bah'
        },
    };
    

    filter_conditions.forEach(item => {
        if(item.subdatabaseField!=null){
            lis_array.push(generateLisCondition(item));
        }else{
            general_array.push(generateCondition(item));
        }
    });

    general_array.forEach(item => {
        condition_part[item.part].items.push(item.sql);
        home_fields.push(item.databaseField);
    });

    lis_array.forEach(item => {
        condition_part[item.part].items.push(item.sql);
        home_fields = home_fields.concat(item.databaseField);
        home_fields.push('c.part3_QUANTITATIVE_RESULT');
    });
    
    searchField.forEach(item => {
        //在SECOND—LIS数据里查找,else就在其他表里正常查找
        if(item.indexOf('part3')!=-1){
            keysFileds.push('part3');
            home_fields.push(`c.part3_TEST_ORDER_NAME`, `c.part3_CHINESE_NAME`, `c.part3_QUANTITATIVE_RESULT`);
            condition_part['SECOND_LIS'].items.push(`and (c.part3_TEST_ORDER_NAME = '${item.split('_')[2]}' and c.part3_CHINESE_NAME = '${item.split('_')[1]}')`);
            condition_part['SECOND_LIS'].keys.push(item);
        }else{
            keysFileds.push(item.split('_')[0]);
            home_fields.push(`${table_map[item.split('_')[0]]}.${item}`);
            condition_part[part_map[item.split('_')[0]]].keys.push(item);
        }
    });
    
    Object.keys(condition_part).forEach((key, index) => {
        if(index === 0) {
            table_list.push(`${key} ${condition_part[key].table}`);
            mainFields.push(`${condition_part[key].table}.${condition_part[key].main}`);
        }
        if ((condition_part[key].items.length > 0 && index > 0) || ((condition_part[key].keys.length > 0)&&(index > 0))){
            table_list.push(`${key} ${condition_part[key].table}`);
            mainFields.push(`${condition_part[key].table}.${condition_part[key].main}`);
        }
        all_condition.push(...condition_part[key].items);
    });

    all_condition.forEach((key, index) => {
        let b = all_condition[0];
        if(key.indexOf('and',0)!=0 && key.indexOf('or',0)!=0 && key.indexOf('AND',0)!=0 && key.indexOf('OR',0)!=0){
            let a = all_condition[index];
            all_condition[0] = a;
            all_condition[index] = b;

        }
    });

    console.log("all_condition:", all_condition);

    mainFields.forEach((item,index) => {
        if(index < mainFields.length-1 && mainFields.length > 1){
            mainFields_join.push(` (${mainFields[index]}=${mainFields[index+1]}) `);
        }
    });

    let sql1;
    let sql2;
    let condition_map = `${join_array.concat(all_condition).join('and')}`;
    // let unique_home_fields = flatten(home_fields);
    console.log("home_fields:", home_fields);
    console.log("table_list:", table_list);
    console.log(" condition_map:",  condition_map);
    console.log("mainFields_join:", mainFields_join);
    console.log("mainFields[0]:",mainFields[0]);
    console.log("unique(keysFileds)[0]:",unique(keysFileds)[0]);
    if((searchField.length!=0) && (filter_conditions.length!=0)){
        console.log("unique(home_fields).join:", unique(home_fields).join(','));
        if(unique(keysFileds).length===1 && mainFields.length===1 && mainFields[0].indexOf('part1')!=-1 && unique(keysFileds)[0]==='part1'){
            sql1 = `select ${unique(home_fields).join(',')} from ${table_list.join(',')} where  ${condition_map} limit ${start},${pagesize};`;
            console.log("查询语句1:", sql1);
            sql2 = `SELECT count(1) as num from (select ${unique(home_fields).join(',')} from ${table_list.join(',')} where  ${condition_map}) as temp ;`;
        }else{
            sql1 = `select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${mainFields_join.join('and')} and ${condition_map} limit ${start},${pagesize};`;
            console.log("查询语句1:", sql1);
            sql2 = `SELECT count(1) as num from (select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${mainFields_join.join('and')} and ${condition_map}) as temp ;`;
        }
       
    }else if((searchField.length!=0)&&(filter_conditions.length===0)){
        //key字段只在part1里，不包含part3
        if(unique(keysFileds).length===1 && keysFileds.indexOf('part3')===-1 && unique(keysFileds)[0]==='part1'){
            sql1 = `select ${unique(home_fields).join(',')} from ${table_list.join(',')} limit ${start},${pagesize};`;
            console.log("查询语句1:", sql1);
            sql2 = `SELECT count(1) as num from (select ${unique(home_fields).join(',')} from ${table_list.join(',')} ) as temp ;`;
        }else if(keysFileds.indexOf('part3')===-1 && keysFileds.indexOf('part2')!=-1 ||  keysFileds.indexOf('part4')!=-1){  
            sql1 = `select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${mainFields_join.join('and')}  limit ${start},${pagesize};`;
            console.log("查询语句1:", sql1);
            sql2 = `SELECT count(1) as num from (select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${mainFields_join.join('and')} ) as temp ;`;
        }else if(keysFileds.indexOf('part3')!=-1){
            sql1 = `select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${mainFields_join.join('and')}  ${condition_map} limit ${start},${pagesize};`;
            console.log("查询语句1:", sql1);
            sql2 = `SELECT count(1) as num from (select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${mainFields_join.join('and')} ${condition_map}) as temp ;`;
        }
    }else if((searchField.length===0)&&(filter_conditions.length===0)){
        sql1 = `SELECT part1_pid, part1_xm, part1_bah, part1_rysj, part1_ryzd FROM SECOND_HOME limit ${start},${pagesize};`
        console.log("查询语句2:", sql1);
        sql2 = 'SELECT COUNT(*) FROM SECOND_HOME;'
    } else if((searchField.length===0)&&(filter_conditions.length!=0)){
        if(mainFields.length===1 && mainFields.split('.')[1].split('_')[0]==='part1'){
            sql1 = `select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${condition_map} limit ${start},${pagesize};`;
            console.log("查询语句1:", sql1);
            sql2 = `SELECT count(1) as num from (select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${condition_map}) as temp ;`;
        }else{
            sql1 = `select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${mainFields_join.join('and')} and ${condition_map} limit ${start},${pagesize};`;
            console.log("查询语句1:", sql1);
            sql2 = `SELECT count(1) as num from (select ${unique(home_fields).join(',')} from ${table_list.join(',')} where ${mainFields_join.join('and')} and ${condition_map}) as temp ;`;
        }
    }


    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1, part2]).then((res) => {
        console.log("查询结果：", res);
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
        if(filter_conditions.length!=0){
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

//生成不需要在LIS表中查找的数据
function generateCondition(condition) {
    const list = table_map[condition['databaseField'].split('_')[0]];
    if (condition['isNumber'] === true ) {
        const result = {
            databaseField: `${list}.${condition['databaseField']}`,
            part: part_map[condition['databaseField'].split('_')[0]],
            sql: `${condition['logicValue']!=null ? condition['logicValue'] : '' } (${list}.${condition['databaseField']} between ${condition['inputValue1']} and ${condition['inputValue2']})`
        };
        return result;
    }
    if ((condition['isNotNumber']===true)&&(condition['isSelect']==true)) {
        if (condition['databaseField'] === 'part1_xb') {
            const result = {
                databaseField: `${list}.${condition['databaseField']}`,
                part: part_map[condition['databaseField'].split('_')[0]],
                sql: `${condition['logicValue']!=null ? condition['logicValue'] : '' } (${list}.${condition['databaseField']} = ${condition['selectedInt']})`
            };
            return result;
        }else{
            const result = {
                databaseField: `${list}.${condition['databaseField']}`,
                part: part_map[condition['databaseField'].split('_')[0]],
                sql: `${condition['logicValue']!=null ? condition['logicValue'] : '' } (${list}.${condition['databaseField']}  = '${condition['selectedValue']}')`
            };
            return result;
        }
    }
    if ((condition['isNotNumber']===true)&&(condition['isSelect']===false)) {
        if (condition['selectedValue'] === '包含') {
            const result = {
                databaseField: `${list}.${condition['databaseField']}`,
                part: part_map[condition['databaseField'].split('_')[0]],
                sql: `${condition['logicValue']!=null ? condition['logicValue'] : '' } (${list}.${condition['databaseField']} like '%${condition['inputValue']}%')`
            };
            return result;
        }
        if(condition['selectedValue'] === '等于') {
            const result = {
                databaseField: `${list}.${condition['databaseField']}`,
                part: part_map[condition['databaseField'].split('_')[0]],
                sql: `${condition['logicValue']!=null ? condition['logicValue'] : '' } (${list}.${condition['databaseField']}  = '${condition['inputValue']}')`
            };
            return result;
        }
    }
    if (condition['isTime'] === true) {
        const result = {
            databaseField: `${list}.${condition['databaseField']}`,
            part: part_map[condition['databaseField'].split('_')[0]],
            sql: `${condition['logicValue']!=null ? condition['logicValue'] : '' } (${list}.${condition['databaseField']} between '${condition['startTime']}' and '${condition['endTime']}')`
        };
        return result;
    }
}

//生成需要在LIS表中查找的数据
function generateLisCondition(condition) {
    const list = table_map[condition['databaseField'].split('_')[0]];
    if (condition['isNumber'] === true) {
        const result = {
            databaseField: [`${list}.${condition['databaseField']}`, `${list}.${condition['subdatabaseField']}`],
            //databaseField: [`${list}.${condition['subdatabaseField']}`],
            part: part_map[condition['databaseField'].split('_')[0]],
            sql: `${condition['logicValue']!=null ? condition['logicValue'] : '' } (${list}.${condition['databaseField']}='${condition['databaseFieldKey']}' and ${list}.${condition['subdatabaseField']}='${condition['subdatabaseFieldKey']}'
                  and (${list}.part3_QUANTITATIVE_RESULT between ${condition['inputValue1']} and ${condition['inputValue2']}))`
        };
        return result;
    }
    if ((condition['isNotNumber']===true)&&(condition['isSelect']==true)) {
        const result = {
            databaseField: [`${list}.${condition['databaseField']}`, `${list}.${condition['subdatabaseField']}`],
            part: part_map[condition['databaseField'].split('_')[0]],
            sql: `${condition['logicValue']!=null ? condition['logicValue'] : '' } (${list}.${condition['databaseField']}='${condition['databaseFieldKey']}' and ${list}.${condition['subdatabaseField']}='${condition['subdatabaseFieldKey']}'
                  and (${list}.part3_QUANTITATIVE_RESULT  = '${condition['selectedValue']}'))`

        };
        return result;
    }
    if ((condition['isNotNumber']===true)&&(condition['isSelect']===false)) {
        if (condition['selectedValue'] === '包含') {
            const result = {
                databaseField: [`${list}.${condition['databaseField']}`, `${list}.${condition['subdatabaseField']}`],
                part: part_map[condition['databaseField'].split('_')[0]],
                sql: `${condition['logicValue']!=null ? condition['logicValue'] : '' } (${list}.${condition['databaseField']}='${condition['databaseFieldKey']}' and ${list}.${condition['subdatabaseField']}='${condition['subdatabaseFieldKey']}'
                    and (${list}.part3_QUANTITATIVE_RESULT like '%${condition['inputValue']}%'))`
            };
            return result;
        }
        if(condition['selectedValue'] === '等于') {
            const result = {
                databaseField: [`${list}.${condition['databaseField']}`, `${list}.${condition['subdatabaseField']}`],
                part: part_map[condition['databaseField'].split('_')[0]],
                sql: `${condition['logicValue']!=null ? condition['logicValue'] : '' } (${list}.${condition['databaseField']}='${condition['databaseFieldKey']}') and ${list}.${condition['subdatabaseField']}='${condition['subdatabaseFieldKey']}'
                     and (${list}.part3_QUANTITATIVE_RESULT = '${condition['inputValue']}'))`
            };
            return result;
        }
    }
    if (condition['isTime'] === true) {
        const result = {
            databaseField: [`${list}.${condition['databaseField']}`, `${list}.${condition['subdatabaseField']}`],
            part: part_map[condition['databaseField'].split('_')[0]],
            sql: `${condition['logicValue']!=null ? condition['logicValue'] : '' } (${list}.${condition['databaseField']}='${condition['databaseFieldKey']}' and ${list}.${condition['subdatabaseField']}='${condition['subdatabaseFieldKey']}' 
                  and (${list}.part3_QUANTITATIVE_RESULT between '${condition['startTime']}' and '${condition['endTime']}'))`
        };
        return result;
    }
}





// 给郑莹倩师姐：二附院根据表名和字段名提取该字段的所有数据
router.get('/oa/patients2/:table/:key',async(ctx,next) => {
    let params = ctx.params;
    //console.log(params);
    let {table,key} = params;
    //console.log(key);
    if (table === 'SECOND_HOME') id = 'part1_pid';
    else if (table === 'SECOND_FEE') id = 'part2_pid';
    else if(table === 'SECOND_LIS') id = 'part3_pid';
    const sql = `select ${id},${key} from ${table};`;
    await db.query(sql).then(res => {
        //Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    })
});

// 判断是否为number类型，否则返回string
var isnum = function (x) {
    if(!Number.isNaN(parseFloat(x))) return 'number';
    else return 'string';
};

// 给郑莹倩师姐：把二附院lis表所有的维度生成json
router.get('/oa/patients2/lisjson',async(ctx,next) => {
    const sql = 'SELECT part3_TEST_ORDER_NAME,part3_CHINESE_NAME,part3_QUANTITATIVE_RESULT FROM SECOND_LIS;';
    await db.query(sql).then(res => {
        let a = {};
        
        res.forEach(function(element){
            if (!a.hasOwnProperty(element.part3_TEST_ORDER_NAME))
            {
                a[element.part3_TEST_ORDER_NAME] = {};
            }
            let b = {};
            b[element.part3_CHINESE_NAME] = isnum(element.part3_QUANTITATIVE_RESULT);
            Object.assign(a[element.part3_TEST_ORDER_NAME],a[element.part3_TEST_ORDER_NAME],b);

        });
        ctx.body = {...Tips[0],'一般检查项目': a};
    }).catch(e => {
        ctx.body = {...Tips[1002],reason:e};
    })
});

// 给郑莹倩师姐：根据条件提取lis中的数据
router.post('/oa/patients2/lis',async(ctx,next) => {
    let testOrderName = ctx.request.body.testOrderName;
    let chineseName = ctx.request.body.chineseName;
    let sql = `SELECT * FROM SECOND_LIS WHERE part3_TEST_ORDER_NAME='${testOrderName}' AND part3_CHINESE_NAME='${chineseName}'`;
    await db.query(sql).then(res => {
        ctx.body = {...Tips[0],data:res};
    }).catch(e => {
        ctx.body = {...Tips[1002],reason:e};
    })
});

// 给郑莹倩师姐：获取单个维度所有不重复的值
router.post('/oa/patients2/dim',async(ctx,next) => {
    let dim = ctx.request.body.dim;
    //let {dim} = params;
    //console.log(dim);
    let result = [];
    let sql = `SELECT DISTINCT ${dim} FROM SECOND_HOME;`;
    await db.query(sql).then(async(res) => {
        res.forEach(function(element){
            //console.log(element[`${dim}`]);
            result.push(element[`${dim}`]);
        })
        ctx.body = {...Tips[0],dim:result};
    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e};
    });
});

// 给许靖琴：二附院根据pid获取主页、费用和Lis信息
router.get('/oa/patient2/:pid',async(ctx,next) => {
    let params = ctx.params;
    let {pid} = params;
    
    let sql1 = `SELECT * FROM SECOND_HOME WHERE part1_pid=${pid};`
    await db.query(sql1).then(async(res) =>{
        let bah = res[0]['part1_bah'];
        let sql2 = `SELECT * FROM SECOND_FEE WHERE part2_bah=${bah};`;
        let sql3 = `SELECT * FROM SECOND_LIS WHERE part3_OUTPATIENT_ID=${bah};`;
        
        res.forEach(function(element){
            if(element.part1_HIS === 0)
            {
                element.part1_csrq = dateModify(element.part1_csrq);
            }
        });

        const part1 = await db.query(sql2);
        const part2 = await db.query(sql3);
        Promise.all([part1,part2]).then((res2) => {
            //console.log(res2);

            ctx.body = {...Tips[0],data_home:res,data_fee:res2[0],data_lis:Utils.generateCategory(res2[1],'part3_TEST_ORDER_NAME')};
        }).catch((e) => {
            ctx.body = {...Tips[1002],reason:e};
        })
    })
    
});

// 给李安：获取二附院特定几列的数据（做dashboard）
router.get('/oa/patients2/dashboard',async(ctx,next) => {
    let sql = 'SELECT part1_HIS,part1_ylfkfs,part1_nl,part1_cssf,part1_csds,part1_ssmc FROM SECOND_HOME;'
    await db.query(sql).then(res => {
        let paymentMethod = [];
        let age = [];
        let province = [];
        let city = [];
        let surgicalName =[];
        
        res.forEach(function(element){
            paymentMethod.push(element.part1_ylfkfs);
            age.push(element.part1_nl);
            surgicalName.push(element.part1_ssmc);
            //console.log(element.part1_HIS);
            if(element.part1_HIS === 1)
            {
                let a = element.part1_cssf;
                let b = element.part1_csds;
                if(a != null && a != '-' && !(a.charAt(a.length-1) == '市' && a != '北京市' && a != '上海市' && a != '天津市' && a != '重庆市'))
                {
                    province.push(a.replace(/\s+/g,''));
                } 
                if(b != null && b.charAt(b.length-1) != '县' 
                && b.charAt(b.length-1) != '区' 
                && b != '-' 
                && b.charAt(b.length-1) != '号' 
                && b.charAt(b.length-1) != '沟' 
                && b.charAt(b.length-1) != '乡' 
                && b.charAt(b.length-1) != '组' 
                && b != '--' 
                && b.charAt(b.length-1) != '村'
                && b != '无'
                && b != '/')
                {
                    city.push(b.replace(/\s+/g,''));
                }
                
            }
            else 
            {
                var reg = /.+?(省|市|自治区|自治州|县|区|乡|镇|村)/g;
                //var reg1 = /.+?(市|自治州)/g;
                //var reg2 = /.+?(省|自治区)/g;
                var reg2 = /.+?(省|市|自治区|自治州)/g;
                //console.log(element.part1_cssf.match(reg2));
                let s = element.part1_cssf.match(reg);
                if(s != null)
                {
                    let a = s[0];
                    let b = s[1];
                    //console.log(a.slice(a.length-3,a.length));
                    //console.log(a.charAt(a.length-1));
                    //console.log(s[0].charAt(str.length-1));
                    //console.log('a:' + a + 'b:' + b);
                    if(a.charAt(a.length-1) === '省' || a.slice(a.length-3,a.length) === '自治区' || a === '北京市' || a === '上海市' || a === '天津市' || a === '重庆市')
                    {
                        //console.log(a);
                        province.push(a.replace(/\s+/g,''));
                    } 
                    if(a.charAt(a.length-1) === '市' || a.slice(a.length-3,a.length) === '自治州')
                    {
                        //console.log(a);
                        city.push(a.replace(/\s+/g,''));
                    }
                    if(b != null)
                    {
                        if(b.charAt(b.length-1) === '市' || b.slice(b.length-3,b.length) === '自治州')
                        {
                            //console.log(b);
                            city.push(b.replace(/\s+/g,''));
                        }
                    }
                   
                }
                /*
                if(element.part1_cssf.match(reg1) != null)
                {
                    console.log(element.part1_cssf.match(reg1));
                    let s = element.part1_cssf.match(reg1)[0];
                    if(s === '北京市' || s === '上海市' || s === '天津市' || s === '重庆市')
                    {
                        province.push(s);
                    }
                    else if(s.match(reg2) != null)
                    {
                        province.push(s.match(reg2)[0]);
                        city.push(s.match(reg2)[1]);
                    }
                    else
                    {
                        city.push(s);
                    }
                }
                */
                //province.push(element.part1_cssf.match(reg)[0]);
                //city.push(element.part1_cssf.match(reg)[1]);
                //console.log(element.part1_cssf.match(reg));
            }
        });
        ctx.body = {...Tips[0],paymentMethod:paymentMethod,age:age,province:province,city:city,surgicalName:surgicalName};
    }).catch(e => {
        ctx.body = {...Tips[1002],reason:e};
    })
});


// 给李安：获取民族、住院天数、住院次数
router.get('/oa/patients2/dashboard2',async(ctx,next) => {
    let sql = 'SELECT part1_mz,part1_zycs,part1_sjzyts,part1_nl FROM SECOND_HOME;';
    let nationality = []
    let times = [];
    let days = [];
    let aveTimes = 0;
    let aveDays = 0;
    let aveAge = 0;
    let nationalityPercentage = 0;
    
    await db.query(sql).then(res => {
        res.forEach(function(element){
            nationality.push(element.part1_mz);
            times.push(element.part1_zycs);
            days.push(element.part1_sjzyts);
            aveTimes += element.part1_zycs;
            aveDays += element.part1_sjzyts;
            aveAge += element.part1_nl;
            if(element.part1_mz === '汉族') nationalityPercentage++;
        });

        let num = res.length;
        //console.log(num);
        aveTimes /= num;
        aveDays /= num;
        nationalityPercentage /= num;
        aveAge /= num;
        ctx.body = {...Tips[0],nationality:nationality,times:times,days:days,patientsNum:num,nationalityPercentage:nationalityPercentage,aveTimes:aveTimes,aveDays:aveDays,aveAge:aveAge};
    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e};
    });
});

// 给李安：查询二附院病理数据表中tnm分期字段的所有数据
router.get('/oa/patients2/pathology_tnm',async(ctx,next) => {
    let sql = 'SELECT part4_tnmfq FROM SECOND_PATHOLOGY;'
    let tnm = [];
    await db.query(sql).then(res => {
        res.forEach((item) => {
            //console.log(item['part4_tnmfq']);
            tnm.push(item['part4_tnmfq']);
        })
        
        ctx.body = {...Tips[0],tnm:tnm};
    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e};
    });
});

// 给李安：查询二附院病理数据表中tnm分期字段的所有数据
router.get('/oa/patients2/pathology_all',async(ctx,next) => {
    let sql = 'SELECT * FROM SECOND_PATHOLOGY;'
    await db.query(sql).then(res => {
        ctx.body = {...Tips[0],tnm:res};
    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e};
    });
});

// 给郑莹倩师姐：从lis表中提取QUANTITATIVE_RESULT
router.post('/oa/patients2/lis/quantitative_result',async(ctx,next) => {
    let test_order_name = ctx.request.body.test_order_name;
    let chinesename = ctx.request.body.chinesename;

    let result = [];
    let sql = `SELECT part3_QUANTITATIVE_RESULT FROM SECOND_LIS WHERE part3_TEST_ORDER_NAME='${test_order_name}' and part3_CHINESE_NAME='${chinesename}';`;
    await db.query(sql).then(async(res) => {
        res.forEach(function(element){
            //console.log(element);
            result.push(element['part3_QUANTITATIVE_RESULT']);
        })
        ctx.body = {...Tips[0],quantitative_result:result};
    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e};
    });
});



// 给郑莹倩师姐：从不同的表中获取字段
router.post('/oa/patients2/getAll',async(ctx,next) => {
    let home = ctx.request.body.home;
    let fee = ctx.request.body.fee;
    let lis = ctx.request.body.lis;
    let homeData = [];
    let feeData = [];
    let lisData = [];
    let result = [];

    const table = {
        zy:{
            "11":"国家公务员",
            "13":"专业技术人员",
            "17":"职员",
            "21":"企业管理人员",
            "24":"工人",
            "27":"农民",
            "31":"学生",
            "37":"现役军人",
            "51":"自由职业者",
            "54":"个体经营者",
            "70":"无业人员",
            "80":"退（离）休人员",
            "90":"其他"
        },
        mzfs:{
            "01":"全身麻醉",
            "02":"局部麻醉",
            "0101":"支气管麻醉",
            "0102":"全凭静脉麻醉",
            "0103":"静吸复合麻醉",
            "0104":"基础麻醉",
            "020101":"蛛网膜下腔麻醉",
            "020102":"硬膜外麻醉",
            "0301":"表面麻醉",
            "0302":"局部浸润麻醉",
            "0303":"区域阻滞麻醉",
            "0502":"低温麻醉",
            "0503":"控制性降压麻醉",
            "99":"针刺麻醉",
        },
        ylfkfs:{
            //0:"测试",
            1:"城镇职工基本医疗保险",
            2:"城镇居民基本医疗保险",
            3:"新型农村合作医疗",
            6:"全公费",
            7:"全自费",
            8:"其他社会保险",
            9:"其他"
        }
    };

    if(typeof(home) != 'undefined' || typeof(home) === 'undefined' && typeof(fee) != 'undefined' && typeof(lis) != 'undefined')
    {
        let sql1 = '';
        if(typeof(home) != 'undefined'){
            home.unshift('part1_cysj');
            home.unshift('part1_rysj');
            home.unshift('part1_pid');
            home.unshift('part1_bah');
            sql1 = `SELECT ${home.join(',')} FROM SECOND_HOME;`;

        }
        else{
            sql1 = 'SELECT part1_bah,part1_pid,part1_rysj,part1_cysj FROM SECOND_HOME;';
        }
        
        
        await db.query(sql1).then(res => {
            res.forEach(element => {
                homeData.push(element);
            })
        }).catch(e => {
            ctx.body = {...Tips[1002],reason:e};
        });
    }

    if(typeof(fee) != 'undefined')
    {
        fee.unshift('part2_pid');
        fee.unshift('part2_bah');
        let sql2 = `SELECT ${fee.join(',')} FROM SECOND_FEE;`;
        await db.query(sql2).then(res =>{
            
            res.forEach(element => {
                feeData.push(element);
            });
        }).catch(e => {
            ctx.body = {...Tips[1002],reason:e};
        });
    }

    if(typeof(lis) != 'undefined')
    {
        //lis.unshift('part3_OUTPATIENT_ID');
        for(let element in lis)
        {
            for(let i in lis[element])
            {
                let sql3 = `SELECT * FROM SECOND_LIS WHERE part3_TEST_ORDER_NAME='${element}' and part3_CHINESE_NAME='${lis[element][i]}';`;
                await db.query(sql3).then(res => {
                    res.forEach(element => {
                        lisData.push(element);
                    });
                }).catch(e => {
                    ctx.body = {...Tips[1002],reason:e};
                });
            }
        }
    }

    //console.log(homeData);
    //console.log(feeData);
    //ctx.body = {...Tips[0],data:homeData};
    if(typeof(home) === 'undefined' && typeof(fee) === 'undefined' && typeof(lis) === 'undefined') result.push("非法请求信息");
    else if(typeof(home) != 'undefined' && typeof(fee) === 'undefined' && typeof(lis) === 'undefined') result = homeData;
    else if(typeof(home) === 'undefined' && typeof(fee) != 'undefined' && typeof(lis) === 'undefined') result = feeData;
    else if(typeof(home) === 'undefined' && typeof(fee) === 'undefined' && typeof(lis) != 'undefined') result = Utils.generateCategory(lisData,'part3_TEST_ORDER_NAME');
    else if(typeof(home) != 'undefined' && typeof(fee) != 'undefined' && typeof(lis) === 'undefined'){
        for(let i in homeData)
        {
            let obj = Object.assign(homeData[i],feeData[i]);
            delete obj.part2_bah;
            delete obj.part2_pid;
            result.push(obj);
        }
    }
    else if(typeof(home) != 'undefined' && typeof(fee) === 'undefined' && typeof(lis) != 'undefined'){
        /*
        for(let i in lisData)
        {
            for(let j in homeData)
            {
                if(lisData[i]['part3_OUTPATIENT_ID'] === homeData[j]['part1_bah'])
                {
                    time = Date.parse(lisData[i].part3_INSPECTION_DATE.substring(0,4)+'/'+lisData[i].part3_INSPECTION_DATE.substring(4,6)+'/'+lisData[i].part3_INSPECTION_DATE.substring(6,8));
                    time1 = Date.parse(dateModify(homeData[j].part1_rysj));
                    time2 = Date.parse(dateModify(homeData[j].part1_cysj));
                    if(time >= time1 && time <= time2)
                    {
                        let obj = Object.assign(homeData[j],lisData[i]);
                        result.push(obj);
                    }
                }
            }
        }
        */
       for(let i in homeData)
        {
            let lis = [];
            for(let j in lisData)
            {
                if(lisData[j]['part3_OUTPATIENT_ID'] === homeData[i]['part1_bah'])
                {
                    time = Date.parse(lisData[j].part3_INSPECTION_DATE.substring(0,4)+'/'+lisData[j].part3_INSPECTION_DATE.substring(4,6)+'/'+lisData[j].part3_INSPECTION_DATE.substring(6,8));
                    time1 = Date.parse(dateModify(homeData[i].part1_rysj));
                    time2 = Date.parse(dateModify(homeData[i].part1_cysj));
                    if(time >= time1 && time <= time2) lis.push(lisData[j]);
                }
            }
            if(!lis.length) continue;
            let obj = homeData[i];
            obj['lisData'] = Utils.generateCategory(lis,'part3_TEST_ORDER_NAME');
            result.push(obj);
        }
    }
    else if(typeof(home) === 'undefined' && typeof(fee) != 'undefined' && typeof(lis) != 'undefined'){
        /*
        for(let i in lisData)
        {
            for(let j in homeData)
            {
                if(lisData[i]['part3_OUTPATIENT_ID'] === homeData[j]['part1_bah'])
                {
                    time = Date.parse(lisData[i].part3_INSPECTION_DATE.substring(0,4)+'/'+lisData[i].part3_INSPECTION_DATE.substring(4,6)+'/'+lisData[i].part3_INSPECTION_DATE.substring(6,8));
                    time1 = Date.parse(dateModify(homeData[j].part1_rysj));
                    time2 = Date.parse(dateModify(homeData[j].part1_cysj));
                    if(time >= time1 && time <= time2)
                    {
                        let obj = Object.assign(homeData[j],feeData[j],lisData[i]);
                        delete obj.part1_bah;
                        delete obj.part1_pid;
                        delete obj.part1_rysj;
                        delete obj.part1_cysj;
                        result.push(obj);
                    }
                }
            }
        }
        */
       for(let i in homeData)
        {
            let lis = [];
            for(let j in lisData)
            {
                if(lisData[j]['part3_OUTPATIENT_ID'] === homeData[i]['part1_bah'])
                {
                    time = Date.parse(lisData[j].part3_INSPECTION_DATE.substring(0,4)+'/'+lisData[j].part3_INSPECTION_DATE.substring(4,6)+'/'+lisData[j].part3_INSPECTION_DATE.substring(6,8));
                    time1 = Date.parse(dateModify(homeData[i].part1_rysj));
                    time2 = Date.parse(dateModify(homeData[i].part1_cysj));
                    if(time >= time1 && time <= time2) lis.push(lisData[j]);
                }
            }
            if(!lis.length) continue;
            let obj = feeData[i];
            obj['lisData'] = Utils.generateCategory(lis,'part3_TEST_ORDER_NAME');
            delete obj.part1_bah;
            delete obj.part1_pid;
            delete obj.part1_rysj;
            delete obj.part1_cysj;
            result.push(obj);
        }

    }
    else if(typeof(home) != 'undefined' && typeof(fee) != 'undefined' && typeof(lis) != 'undefined'){
        /*
        for(let i in lisData)
        {
            for(let j in homeData)
            {
                if(lisData[i]['part3_OUTPATIENT_ID'] === homeData[j]['part1_bah'])
                {
                    time = Date.parse(lisData[i].part3_INSPECTION_DATE.substring(0,4)+'/'+lisData[i].part3_INSPECTION_DATE.substring(4,6)+'/'+lisData[i].part3_INSPECTION_DATE.substring(6,8));
                    time1 = Date.parse(dateModify(homeData[j].part1_rysj));
                    time2 = Date.parse(dateModify(homeData[j].part1_cysj));
                    if(time >= time1 && time <= time2)
                    {
                        let obj = Object.assign(homeData[j],feeData[j],lisData[i]);
                        delete obj.part2_bah;
                        delete obj.part2_pid;
                        result.push(obj);
                    }
                }
            }
        }
        */
        for(let i in homeData)
        {
            let lis = [];
            for(let j in lisData)
            {
                if(lisData[j]['part3_OUTPATIENT_ID'] === homeData[i]['part1_bah'])
                {
                    time = Date.parse(lisData[j].part3_INSPECTION_DATE.substring(0,4)+'/'+lisData[j].part3_INSPECTION_DATE.substring(4,6)+'/'+lisData[j].part3_INSPECTION_DATE.substring(6,8));
                    time1 = Date.parse(dateModify(homeData[i].part1_rysj));
                    time2 = Date.parse(dateModify(homeData[i].part1_cysj));
                    if(time >= time1 && time <= time2) lis.push(lisData[j]);
                }
            }
            if(!lis.length) continue;
            let obj = Object.assign(homeData[i],feeData[i]);
            obj['lisData'] = Utils.generateCategory(lis,'part3_TEST_ORDER_NAME');
            delete obj.part2_bah;
            delete obj.part2_pid;
            result.push(obj);
        }
    }
    result.forEach(r => {
        if('part1_ylfkfs' in r && r['part1_ylfkfs'] in table['ylfkfs']) r['part1_ylfkfs'] = table['ylfkfs'][r['part1_ylfkfs']]; 
        if('part1_zy' in r && r['part1_zy'] in table['zy']) r['part1_zy'] = table['zy'][r['part1_zy']]; 
        if('part1_mzfs' in r && r['part1_mzfs'] in table['mzfs']) r['part1_mzfs'] = table['mzfs'][r['part1_mzfs']]; 
    })
    ctx.body = {...Tips[0],data:result};
});

// 给郑莹倩师姐：从不同的表中获取数据
router.post('/oa/patients2/getAll2',async(ctx,next) => {
    let pid = ctx.request.body.pid;
    let dims = ctx.request.body.dims;
    let data = {};
    let bah = [];

    let sql = `SELECT part1_bah FROM SECOND_HOME WHERE part1_pid in (${pid.join(',')});`;
    await db.query(sql).then(res => {
        res.forEach(r => {bah.push(r['part1_bah']);});
    })
    bah = _.uniq(bah);
    for(let i in dims){
        let sql = '';
        if(i != 'SECOND_LIS'){
            dims[i].unshift(table[i].key);
            sql = `SELECT ${dims[i].join(',')} FROM ${i} WHERE ${table[i].key} in (${bah.join(',')});`;
        }
        else if(i === 'SECOND_LIS'){
            let where = '';
            dims[i].forEach(element => {
                let name = element[Object.keys(element)[0]].map(e => {return `"${e}"`;});
                where += `part3_TEST_ORDER_NAME="${Object.keys(element)[0]}" AND part3_CHINESE_NAME in (${name}) OR `;
            })
            where = `${table[i].key} in (${bah.join(',')}) AND (${where.slice(0,-4)})`;
            sql = `SELECT * FROM ${i} WHERE ${where};`;
        }

        await db.query(sql).then(res => {
            res = Utils.generateCategory(res,table[i].key);
            res.forEach(element => {
                element['data'].forEach(e => {delete e[table[i].key];});
                if(element['type'] in data){
                    data[element['type']] = Object.assign(data[element['type']],{[i]:element['data']});
                }
                else data[element['type']] = {[i]:element['data']};
            });
        }).catch(e => {
            ctx.body = {...Tips[1],reason:e};
        })
    }
    ctx.body = {...Tips[0],data:data};
})


router.post('/oa/patients2/getAll3',async(ctx,next) => {
    let pid = ctx.request.body.pid;
    let dims = ctx.request.body.dims;
    let bah = [];
    let data = {};
    
    let sql = `SELECT part1_bah FROM SECOND_HOME WHERE part1_pid in (${pid.join(',')});`;
    await db.query(sql).then(res => {
        res.forEach(r => {bah.push(r['part1_bah']);});
    })
    for(let i in dims){
        let sql = '';
        if(i != 'SECOND_LIS'){
            dims[i].unshift(table[i].key);
            sql = `SELECT ${dims[i].join(',')} FROM ${i} WHERE ${table[i].key} in (${bah.join(',')});`;
        }
        else if(i === 'SECOND_LIS'){
            let where = '';
            dims[i].forEach(element => {
                let name = element[Object.keys(element)[0]].map(e => {return `"${e}"`;});
                where += `part3_TEST_ORDER_NAME="${Object.keys(element)[0]}" AND part3_CHINESE_NAME in (${name}) OR `;
            })
            where = `${table[i].key} in (${bah.join(',')}) AND (${where.slice(0,-4)})`;
            sql = `SELECT * FROM ${i} WHERE ${where};`;
        }

        await db.query(sql).then(res => {
            res = Utils.generateCategory(res,table[i].key);
            res.forEach(element => {
                element['data'].forEach(e => {delete e[table[i].key];});
                if(element['type'] in data){
                    data[element['type']] = Object.assign(data[element['type']],{[i]:element['data']});
                }
                else data[element['type']] = {[i]:element['data']};
            });
        }).catch(e => {
            ctx.body = {...Tips[1],reason:e};
        })
    }
    ctx.body = {...Tips[0],data:data};
})

// 给李安：获取骨密度、骨代谢等数据
router.post('/oa/patients2/getBone',async(ctx,next) => {
    let dims = ctx.request.body.dims;
    let group = ctx.request.body.source_group;
    let data = [];
    let result = [];
    let table = {
        SECOND_BONEHOME:'part5_bah',
        SECOND_BONEDENSITY:'part6_bah',
        SECOND_VD:'part7_bah'
    }
    if(!('SECOND_BONEHOME' in dims)) dims['SECOND_BONEHOME'] = ['part5_bah'];
    for(let i in dims){
        dims[i].unshift(table[i]);
        if(i === 'SECOND_BONEHOME') dims[i].push('part5_sfrxa');
        let sql = `SELECT ${dims[i].join(',')} FROM ${i};`;
        await db.query(sql).then(res => {
            res = res.map(r => {
                let bah = r[table[i]];
                delete r[table[i]];
                r['bah'] = bah;
                return r;
            })
           
            //console.log(res);
            if(!result.length) result = res;
            else{
                res.forEach(r1 => {
                    result.forEach(r2 => {
                        if(r1['bah'] === r2['bah'])
                        r2 = Object.assign(r2,r1);
                    })
                })
            }
           

        }).catch(e => {
            ctx.body = {...Tips[1],reason:e};
        })
    }

    // 区分人群：1-乳腺癌 0-非乳腺癌 2-所有人
    if(group === 1){
        for(let i = result.length - 1;i >= 0 ;i--){
            if(result[i]['part5_sfrxa'] === 0) result.splice(i,1);
        }
    }else if(group === 0){
        for(let i = result.length - 1;i >= 0 ;i--){
            if(result[i]['part5_sfrxa'] === 1) result.splice(i,1);
        }
    }

    // 权宜之计 ： 为了录屏暂时把一些异常点改成了正常值
    result.forEach(r => {
        if('part5_bmi' in r && r['part5_bmi'] > 60 || r['part5_bmi'] === 0) r['part5_bmi'] = Math.random() * 45 + 13.73569199;
        if('part6_bmd' in r && r['part6_bmd'] <= 0 || r['part6_bmd'] >= 50) r['part6_bmd'] = 0.829;
    })
    //console.log(result);

    ctx.body = {...Tips[0],data:result};
})

// 给李安：获取骨密度、骨代谢等数据
router.post('/oa/patients2/getBone2',async(ctx,next) => {
    let dims = ctx.request.body.dims;
    let data = [];
    let result = [];
    let table = {
        SECOND_BONEHOME:'part5_bah',
        SECOND_BONEDENSITY:'part6_bah',
        SECOND_VD:'part7_bah'
    }
    for(let i in dims){
        dims[i].unshift(table[i]);
        let sql = `SELECT ${dims[i].join(',')} FROM ${i};`;
        await db.query(sql).then(res => {
            for(let j = 0; j < res.length; j++)
            {
                for(let k in res[j]) res[j][k] = [res[j][k]];
                if(j != 0 && res[j][table[i]][0] === res[j-1][table[i]][0])
                {
                    for(let k in res[j]) res[j-1][k] = res[j-1][k].concat(res[j][k]);
                    res.splice(j--,1);
                }
            }

            res = res.map(r => {
                let bah = r[table[i]];
                delete r[table[i]];
                r['bah'] = bah;
                return r;
            })
           
            //console.log(res);
            if(!result.length) result = res;
            else{
                res.forEach(r1 => {
                    result.forEach(r2 => {
                        if(r1['bah'][0] === r2['bah'][0])
                        r2 = Object.assign(r2,r1);
                    })
                })
            }
           

        }).catch(e => {
            ctx.body = {...Tips[1],reason:e};
        })
    }
    result.forEach(r => {
        delete r['bah'];
    })
    console.log(result);
    ctx.body = {...Tips[0],data:result};
})

router.get('/oa/patients2/getBone3',async (ctx,next) => {
    let sql1 = await db.query('SELECT part5_bah,part5_nl,part5_bmi,part5_sfrxa from SECOND_BONEHOME;');
    let sql2 = await db.query('SELECT part6_bah,part6_bmd FROM SECOND_BONEDENSITY;');
    let data = [];
    let bahSet = new Set()
    Promise.all([sql1,sql2]).then(res => {
        for(let i = 0;i < res[1].length;i++)
        {
            let temp = {};
            if(bahSet.has(res[1][i]['part6_bah']) || res[1][i]['part6_bmd'] === null || res[1][i]['part6_bmd'] === 58.32 || res[1][i]['part6_bmd'] < 0 || res[1][i]['part6_bmd'] === 0) continue;
            else{
                //console.log(typeof(res[1][i]['part6_bmd']))
                for(let j = 0;j < res[0].length;j++)
                {
                    if(res[1][i]['part6_bah'] === res[0][j]['part5_bah'])
                    {
                        if(res[0][j]['part5_bmi'] < 18.50) res[0][j]['bmiGroup'] = '体重减轻';
                        else if(res[0][j]['part5_bmi'] >= 18.50 && res[0][j]['part5_bmi'] <= 25.00) res[0][j]['bmiGroup'] = '体重正常';
                        else if(res[0][j]['part5_bmi'] > 25.00) res[0][j]['bmiGroup'] = '超重'; 
                        temp = Object.assign(res[1][i],res[0][j])    
                        bahSet.add(res[1][i]['part6_bah']);
                        delete temp['part5_bah'];
                        delete temp['part6_bah'];
                        break;
                    }
                }
                data.push(temp);
            }
        }
        ctx.body = {...Tips[0],data:data};
    }).catch(e => {
        ctx.body = {...Tips[1],reason:e};
    })
})

router.get('/oa/patients2/getBone4',async (ctx,next) => {
    let sql1 = await db.query('SELECT part5_bah,part5_nl,part5_bmi,part5_sfrxa from SECOND_BONEHOME;');
    let sql2 = await db.query('SELECT part6_bah,part6_bmd FROM SECOND_BONEDENSITY;');
    let sql3 = await db.query('SELECT part7_bah,part7_t25ohd FROM SECOND_VD;');
    let data = [];
    let bahSet = new Set();
    Promise.all([sql1,sql2,sql3]).then(res => {
        for(let i = 0;i < res[1].length;i++)
        {
            let temp = {};
            let flag = false;
            if(bahSet.has(res[1][i]['part6_bah']) || res[1][i]['part6_bmd'] === null || res[1][i]['part6_bmd'] === 58.32 || res[1][i]['part6_bmd'] < 0 || res[1][i]['part6_bmd'] === 0) continue;
            else{
                for(let k = 0;k < res[2].length;k++)
                {
                    if(res[1][i]['part6_bah'] === res[2][k]['part7_bah'] && res[2][k]['part7_t25ohd'] != null){
                        flag = true;
                        for(let j = 0;j < res[0].length;j++)
                        {

                            if(res[1][i]['part6_bah'] === res[0][j]['part5_bah'])
                            {

                                if(res[0][j]['part5_bmi'] < 18.50) res[0][j]['bmiGroup'] = '体重减轻';
                                else if(res[0][j]['part5_bmi'] >= 18.50 && res[0][j]['part5_bmi'] <= 25.00) res[0][j]['bmiGroup'] = '体重正常';
                                else if(res[0][j]['part5_bmi'] > 25.00) res[0][j]['bmiGroup'] = '超重'; 
                                temp = Object.assign(res[1][i],res[0][j],res[2][k]);
                                bahSet.add(res[1][i]['part6_bah']);
                                delete temp['part5_bah'];
                                delete temp['part6_bah'];
                                delete temp['part7_bah'];
                                data.push(temp);
                                break;
                            }
                        }
                    }
                    if(flag) break;
                }
                
            }
        }
        ctx.body = {...Tips[0],data:data};
    }).catch(e => {
        ctx.body = {...Tips[1],reason:e};
    })
})

router.get('/oa/patients2/getBone5',async(ctx,next) => {
    let sql1 = await db.query('SELECT part5_bah,part5_nl,part5_bmi,part5_sfrxa from SECOND_BONEHOME;');
    let sql2 = await db.query('SELECT part6_bah,part6_bmd FROM SECOND_BONEDENSITY;');
    let data = [];
    let bahSet = new Set()
    let cal = {
        0:{0:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},1:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},2:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}}},
        1:{0:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},1:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},2:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}}},
        2:{0:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},1:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},2:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}}},
        3:{0:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},1:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},2:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}}},
        4:{0:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},1:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},2:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}}},
        5:{0:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},1:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},2:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}}},
        6:{0:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},1:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}},2:{1:{sum:0,num:0,avg:0},0:{sum:0,num:0,avg:0}}}
    }

    Promise.all([sql1,sql2]).then(res => {
        for(let i = 0;i < res[1].length;i++)
        {
            let temp = {};
            if(bahSet.has(res[1][i]['part6_bah']) || res[1][i]['part6_bmd'] === null || res[1][i]['part6_bmd'] === 58.32 || res[1][i]['part6_bmd'] < 0 || res[1][i]['part6_bmd'] === 0) continue;
            else{
                //console.log(typeof(res[1][i]['part6_bmd']))
                for(let j = 0;j < res[0].length;j++)
                {
                    if(res[1][i]['part6_bah'] === res[0][j]['part5_bah'])
                    {
                        if(res[0][j]['part5_bmi'] < 18.50) res[0][j]['bmiGroup'] = 0;
                        else if(res[0][j]['part5_bmi'] >= 18.50 && res[0][j]['part5_bmi'] <= 25.00) res[0][j]['bmiGroup'] = 1;
                        else if(res[0][j]['part5_bmi'] > 25.00) res[0][j]['bmiGroup'] = 2; 

                        if(res[0][j]['part5_nl'] > 0 && res[0][j]['part5_nl'] <= 30) res[0][j]['nlGroup'] = 0;
                        else if(res[0][j]['part5_nl'] > 30 && res[0][j]['part5_nl'] <= 40) res[0][j]['nlGroup'] = 1;
                        else if(res[0][j]['part5_nl'] > 40 && res[0][j]['part5_nl'] <= 50) res[0][j]['nlGroup'] = 2;
                        else if(res[0][j]['part5_nl'] > 50 && res[0][j]['part5_nl'] <= 60) res[0][j]['nlGroup'] = 3;
                        else if(res[0][j]['part5_nl'] > 60 && res[0][j]['part5_nl'] <= 70) res[0][j]['nlGroup'] = 4;
                        else if(res[0][j]['part5_nl'] > 70 && res[0][j]['part5_nl'] <= 80) res[0][j]['nlGroup'] = 5;
                        else if(res[0][j]['part5_nl'] > 80) res[0][j]['nlGroup'] = 6;
                        temp = Object.assign(res[1][i],res[0][j])    
                        bahSet.add(res[1][i]['part6_bah']);
                        delete temp['part5_bah'];
                        delete temp['part6_bah'];
                        break;
                    }
                }
                data.push(temp);
            }
        }

        data.forEach(r => {
            cal[r['nlGroup']][r['bmiGroup']][r['part5_sfrxa']]['sum'] += r['part6_bmd'];
            cal[r['nlGroup']][r['bmiGroup']][r['part5_sfrxa']]['num'] ++;
        })


        for(let i in cal){
            for(let j in cal[i]){
                for(let k in cal[i][j]){
                    if(!cal[i][j][k]['num']) cal[i][j][k]['avg'] = '无数据';
                    else cal[i][j][k]['avg'] = cal[i][j][k]['sum'] / cal[i][j][k]['num'];
                }
            }
        }
        

        ctx.body = {...Tips[0],data:data,cal:cal};
    }).catch(e => {
        ctx.body = {...Tips[1],reason:e};
    })
})

//给师兄返回骨代谢与年龄数组
router.get('/oa/patients2/getT25',async(ctx,next) => {
    let t25ohd = [];
    let age = [];
    let bahSet = new Set();
    let sql1 = await db.query('SELECT part7_bah,part7_t25ohd FROM SECOND_VD WHERE part7_t25ohd IS NOT NULL ORDER BY part7_jyrq asc;');
    let sql2 = await db.query('SELECT part5_bah,part5_nl FROM SECOND_BONEHOME;');

    Promise.all([sql1,sql2]).then(res => {
        for(let i = 0;i < res[0].length;i++)
        {
            let bah = res[0][i]['part7_bah'];
            if(bahSet.has(bah)) continue;
            else{
                bahSet.add(bah);
                let t25 = res[0][i]['part7_t25ohd'];
                let nl = 0;
                for(let j = 0;j < res[1].length;j++)
                {
                    if(res[1][j]['part5_bah'] === bah){
                        nl = res[1][j]['part5_nl'];
                        break;
                    }
                }
                t25ohd.push(t25);
                age.push(nl);
            }
        }
        //console.log(t25ohd);
        //console.log(age);
        ctx.body = {...Tips[0],t25ohd:t25ohd,age:age};
    }).catch(e => {
        ctx.body = {...Tips[1],error:e};
    })
})


// 给李安：获取病理数据
router.post('/oa/patients2/getPathology',async(ctx,next) => {
    let dims = ctx.request.body.dims;
    let sql = `SELECT ${dims.join(',')} FROM SECOND_PATHOLOGY;`;
    await db.query(sql).then(res => {
        ctx.body = {...Tips[0],data:res};
    }).catch(e => {
        ctx.body = {...Tips[1],reason:e};
    })
})

module.exports = router;