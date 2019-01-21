const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const _ = require('lodash');

const basic_conditions = {
    patientID: 'part1_zylsh',
    patientName: 'part1_xm',
    Disease: 'part1_zzd'
};

const form = {
    病案首页: 'FIRST_HOME',
    //费用明细: 'SECOND_FEE',
}

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

    var conditions = ctx.request.body.condition;
    const condition_array = [];
    /*Object.keys(conditions).forEach(key => {
        if (conditions[key] !== '') {
            condition_array.push(`${basic_conditions[key]} = '${conditions[key]}'`);
        }
    });*/
    const condition_sql = 'WHERE ' + condition_array.join(' AND ');
    const start = (pageindex-1) * pagesize;
    let sql1 = `SELECT * FROM FIRST_HOME  ${condition_array.length === 0 ? '' :condition_sql} limit ${start},${pagesize};`;
    let sql2 = `SELECT COUNT(*) FROM FIRST_HOME ${condition_array.length === 0 ? '' :condition_sql};`;
    //console.log(sql1);
    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1, part2]).then((res) => {
        num = res[1][0]['COUNT(*)'];
        data = res[0];
        //Utils.cleanData(res);
        ctx.body = {...Tips[0],count_num:num,data:data};

    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e}
    })
});

async function queryHome(zyh_array) {
    const zyh = zyh_array.join(',');
    const home_fields = ['part1_pid', 'part1_zyh', 'part1_zylsh', 'part1_xm', 'part1_xb', 'part1_nl', 'part1_zzd', 'part1_rysj', 'part1_cysj'];
    return db.query(`SELECT ${home_fields.join(',')} FROM FIRST_HOME WHERE part1_zyh IN (${zyh})`);
}

async function queryPatient(id, lsh) {
    const zyh = lsh.substr(7, 7);
    const home_data = db.query(`SELECT * FROM FIRST_HOME WHERE part1_pid = ${id}`);
    const advice_data = db.query(`SELECT * FROM FIRST_ADVICE WHERE part2_zyh = '${lsh}'`);
    const lis_data = db.query(`SELECT * FROM FIRST_LIS WHERE part3_zylsh = '${lsh}'`);
    const mazui_data = db.query(`SELECT * FROM FIRST_MAZUI WHERE part4_zylsh = '${lsh}'`);
    const results_data = db.query(`SELECT * FROM FIRST_RESULTS WHERE part5_zyh = ${zyh}`);
    return await Promise.all([home_data, advice_data, lis_data, mazui_data, results_data]);
}

//通过pid获取一附院病人病案首页信息
router.get('/oa/patient1/:pid/:zyh',async(ctx,next) => {

    let {pid, zyh} = ctx.params;
    await queryPatient(pid, zyh).then((res) => {
        ctx.body = {
            ...Tips[0],
            data: {
                home: res[0],
                advice: Utils.generateCategory(res[1], 'part2_yzlb'),
                lis: Utils.generateCategory(res[2], 'part3_xmmc'),
                mazui: res[3],
                results: Utils.generateCategory(res[4], 'part5_jclb')
            }
        }
    }).catch(e => {
        ctx.body = {
            ...Tips[1002],
            error: e
        }
    })
});


router.get('/oa/es_list/', async (ctx, next) => {
    let {query} = ctx.query;
    const related_zyh = [];
    await db.es().search({
        body: {
            highlight: {
                require_field_match: false,
                fields: {
                    "*": {}
                }
            },
            query: {
                query_string: {
                    query: query
                }
            }
        },
        _source: [
            'part5_zyh'
        ]
    }).then(async (res)=> {

        res['hits']['hits'].forEach(item => {
            related_zyh.push(item._source['part5_zyh']);
        });

        const uniq_zyh = _.uniq(related_zyh);
        await queryHome(uniq_zyh).then(res => {
            ctx.body = {status: res};
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
        sql1 = `SELECT part1_xm,part1_zyh,part1_rysj,part1_nl,part1_pid FROM FIRST_HOME limit ${start},${pagesize};`
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



module.exports = router;