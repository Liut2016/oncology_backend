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

const part_map = {
    'part1': 'FIRST_HOME',
    'part2': 'FIRST_ADVICE',
    'part3': 'FIRST_LIS',
    'part4': 'FIRST_MAZUI',
    'part5': 'FIRST_RESULTS'
};


const form = {
    病案首页: 'FIRST_HOME',
    //费用明细: 'SECOND_FEE',
}

const home_keys = 'part1_pid,part1_zylsh,part1_xm,part1_xb,part1_nl,part1_zzd,part1_rysj,part1_cysj';

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
    Object.keys(conditions).forEach(key => {
        if (conditions[key] !== '') {
            condition_array.push(`${basic_conditions[key]} = '${conditions[key]}'`);
        }
    });
    const condition_sql = 'WHERE ' + condition_array.join(' AND ');
    const start = (pageindex-1) * pagesize;
    const home_fields = ['part1_pid', 'part1_zyh', 'part1_zylsh', 'part1_xm', 'part1_xb', 'part1_nl', 'part1_zzd', 'part1_rysj', 'part1_cysj'];
    let sql1 = `SELECT ${home_fields.join(',')} FROM FIRST_HOME  ${condition_array.length === 0 ? '' :condition_sql} limit ${start},${pagesize};`;
    let sql2 = `SELECT COUNT(*) FROM FIRST_HOME ${condition_array.length === 0 ? '' :condition_sql};`;
    //console.log(sql1);
    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1, part2]).then((res) => {
        num = res[1][0]['COUNT(*)'];
        res[0].map(item => {
            item['part1_rysj'] = item['part1_rysj'].substr(0, 16);
            item['part1_cysj'] = item['part1_cysj'].substr(0, 16);
            return item;
        });
        data = res[0];
        //Utils.cleanData(res);
        ctx.body = {...Tips[0],count_num:num,data:data};

    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e}
    })
});

router.post('/oa/filter1', async (ctx, next) => {
    let home_fields = ['part1_pid', 'part1_zyh', 'part1_zylsh', 'part1_xm', 'part1_xb', 'part1_nl', 'part1_zzd', 'part1_rysj', 'part1_cysj'];
    const params = ctx.request.body;
    const start = params['pageindex'] - 1;
    if (params.conditions.length === 0) {
        let sql1 = `SELECT ${home_keys} FROM FIRST_HOME LIMIT ${start}, ${params['pagesize']}`;
        let sql2 = `SELECT COUNT(*) FROM FIRST_HOME`;
        const get_patient = db.query(sql1);
        const get_count = db.query(sql2);
        await Promise.all([get_patient, get_count]).then(res => {
            res[0].map(item => {
                item['part1_rysj'] = item['part1_rysj'].substr(0, 16);
                item['part1_cysj'] = item['part1_cysj'].substr(0, 16);
                return item;
            });
            ctx.body = {...Tips[0],count_num:res[1][0]['COUNT(*)'] ,data:res[0]};
        }).catch(e => {
            ctx.body = {...Tips[1002], reason:e}
        })
    } else {
        const condition_array = [];
        const part_has_condition = ['FIRST_HOME a'];
        const all_condition = [];
        const join_array = [];
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
        params.conditions.forEach(item => {
            condition_array.push(generateCondition(item));
        });

        condition_array.forEach(item => {
            condition_part[item.part].items.push(item.sql);
        });

        Object.keys(condition_part).forEach((key, index) => {
            if (condition_part[key].items.length > 0 && index > 0) {
                part_has_condition.push(`${key} ${condition_part[key].table}`);
            }
            all_condition.push(...condition_part[key].items);
        });

        if (part_has_condition.length === 2) {
            join_array.push('part1_zyh = part5_zyh');
        }
        home_fields = home_fields.map(item => {
            return `a.${item}`;
        });

        const table_map = part_has_condition.join(',');
        const column_map = `${home_fields.join(',')}`;
        const condition_map = `${join_array.concat(all_condition).join(' and ')}`;
        const sql = `select ${column_map} from ${table_map} where ${condition_map}`;
        await db.query(sql).then(res => {
            const uniq_data = Utils.uniqArray(res, 'part1_pid');
            uniq_data.forEach(item => {
                item['part1_rysj'] = item['part1_rysj'].substr(0, 16);
                item['part1_cysj'] = item['part1_cysj'].substr(0, 16);
            });
            ctx.body = {...Tips[0], count_num: uniq_data.length, data: uniq_data.slice(start, start + params['pagesize'])};
        }).catch(e => {
        });
    }
});

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

async function queryHome(zyh_array) {
    const zyh = zyh_array.join(',');
    const home_fields = ['part1_pid', 'part1_zyh', 'part1_zylsh', 'part1_xm', 'part1_zzd'];
    return db.query(`SELECT ${home_fields.join(',')} FROM FIRST_HOME WHERE part1_zyh IN (${zyh})`);
}

async function queryPatient(id, lsh) {
    const zyh = lsh.substr(7, 7);
    const home_data = db.query(`SELECT * FROM FIRST_HOME WHERE part1_pid = ${id}`);
    const advice_data = db.query(`SELECT * FROM FIRST_ADVICE WHERE part2_zyh = '${lsh}'`);
    const lis_data = db.query(`SELECT part3_zylsh, part3_xmmc, part3_xxmmc, part3_sj, part3_jg, part3_ckfw, part3_dw FROM FIRST_LIS WHERE part3_zylsh = '${lsh}'`);
    const mazui_data = db.query(`SELECT * FROM FIRST_MAZUI WHERE part4_zylsh = '${lsh}'`);
    const results_data = db.query(`SELECT * FROM FIRST_RESULTS WHERE part5_zyh = ${zyh}`);
    return await Promise.all([home_data, advice_data, lis_data, mazui_data, results_data]);
}

//通过pid获取一附院病人病案首页信息
router.get('/oa/patient1/:pid/:zyh',async(ctx,next) => {
    let {pid, zyh} = ctx.params;
    await queryPatient(pid, zyh).then((res) => {
        const operation_time = res[0][0]['part1_ssrq'];
        const type_lis = Utils.generateCategory(res[2], 'part3_xmmc');
        type_lis.forEach(type => {
            type.data = Utils.generateCategory(type.data, 'part3_sj');
            type.data.map(item => {
                item['reference'] = item.type < operation_time ? 'before' : 'after';
                return item;
            });
        });
        res[4].map(item => {
            item['part5_jcsj'] = item['part5_jcsj'].substr(0, 16);
            return item;
        });
        ctx.body = {
            ...Tips[0],
            data: {
                home: res[0],
                advice: Utils.generateCategory(res[1], 'part2_yzlb'),
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


router.get('/oa/es_list/', async (ctx, next) => {
    let {query} = ctx.query;
    let words= query.split('');
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
            }
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
            ctx.body = {...Tips[0], count_num:res.length, data: res};
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
router.get('/oa/patients1/dashboard',async(ctx,next) => {
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
        console.log(res);
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
        ctx.body = {...Tips[1002],reason:e};
    });
});






module.exports = router;