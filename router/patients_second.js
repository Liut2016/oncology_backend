const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const _ = require('lodash');

const form = {
    病案首页: 'SECOND_HOME',
    费用明细: 'SECOND_FEE',
}

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



//post方法全点位过滤
router.post('/oa/patients2/filter',async (ctx, next) =>{
    var pagesize = parseInt(ctx.request.body.pagesize);
    var pageindex = parseInt(ctx.request.body.pageindex);
    var isAll = ctx.request.body.isAll;
    var start = pageindex -1;
    var conditions = ctx.request.body.conditions;
    var searchField = [];
    var formType = [];
    var logicValue = [];
    var where_array = [];
    var where = ''  ;
    var set = '';
    conditions.forEach(item => {
        searchField.push(item.databaseField);
        logicValue.push(item.logicValue);
        Object.keys(form).forEach( i => {
            if(i === item.form_type){
                formType.push(form[i]);
            }
        });
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
    where_array.forEach((item, index) => {
          if ( index === where_array.length - 1) {
              where = ` ${where}${item} `;
          }else {
              where = ` ${where}${item}  ${logicValue[index + 1]} `;
          }
    });


    formType.push('SECOND_HOME');
    if(formType.indexOf('SECOND_FEE') !== -1){
        where = `(part1_bah=part2_bah) and ${where}`;
    }

    
    let sql1;
    let sql2;
    if((conditions.length !== 0)&&(isAll===false)) {
        searchField.push('part1_pid', 'part1_bah', 'part1_xm', 'part1_ryzd', 'part1_rysj', 'part1_sjzyts');
        sql1 = `SELECT ${unique(searchField)} FROM ${unique(formType)} where ${where} limit ${start},${pagesize};`;
        sql2 = `SELECT count(1) as num from (SELECT ${unique(searchField)}  FROM ${unique(formType)} where ${where}) as temp ;`;
        // sql2 = `SELECT ${unique(searchField)}, count(1) AS num FROM ${unique(formType)} where ${where} GROUP BY ${unique(searchField)};`;
    }else if((conditions.length!=0)&&(isAll===true)){
        sql1 = `SELECT ${unique(searchField)} FROM ${unique(formType)} where ${where} limit ${start},${pagesize};`;

        sql2 = `SELECT count(1) as num from (SELECT ${unique(searchField)}  FROM ${unique(formType)} where ${where}) as temp ;`;
    }else{
        sql1 = `SELECT part1_pid,part1_bah, part1_xm,part1_ryzd,part1_rysj,part1_sjzyts FROM SECOND_HOME limit ${start},${pagesize};`;
        sql2 = 'SELECT COUNT(*) FROM SECOND_HOME;'
    }

    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1, part2]).then((res) => {
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
                        }
                    }
                })
             });
        if(conditions.length !== 0){
            num = res[1][0]['num'];
        }else{
            num = res[1][0]['COUNT(*)'];
        }
        ctx.body = {...Tips[0],count_num:num,data:data};
        // ctx.body = {...Tips[0],data:data};

    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e}
    })
});


//给郑莹倩师姐：二附院筛选基础上返回特定字段
router.post('/oa/patients2/filter2',async (ctx, next) =>{
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

    formType.push('SECOND_HOME');

    if(formType.indexOf('SECOND_FEE')!=-1){
        where = `(part1_bah=part2_bah) and ${where}`;
    }

    
    let sql1;
    let sql2;
    if((conditions.length!=0)&&(isAll===false)){
        searchField.push('part1_bah', 'part1_xm', 'part1_rysj', 'part1_ryzd' , 'part1_pid');
        sql1 = `SELECT ${unique(searchField)} FROM ${unique(formType)} where ${where} limit ${start},${pagesize};`;
        sql2 = `SELECT count(1) as num from (SELECT ${unique(searchField)}  FROM ${unique(formType)} where ${where}) as temp ;`;
        // sql2 = `SELECT ${unique(searchField)}, count(1) AS num FROM ${unique(formType)} where ${where} GROUP BY ${unique(searchField)};`;
    }else if((conditions.length!=0)&&(isAll===true)){
        sql1 = `SELECT ${unique(searchField)} FROM ${unique(formType)} where ${where};`;
        sql2 = `SELECT count(1) as num from (SELECT ${unique(searchField)}  FROM ${unique(formType)} where ${where}) as temp ;`;
    }else{
        sql1 = `SELECT part1_xm,part1_bah,part1_rysj,part1_ryzd,part1_pid FROM SECOND_HOME limit ${start},${pagesize};`
        sql2 = 'SELECT COUNT(*) FROM SECOND_HOME;'
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
        });
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
    let sql = 'SELECT part1_mz,part1_zycs,part1_sjzyts FROM SECOND_HOME;';
    let nationality = []
    let times = [];
    let days = [];
    let aveTimes = 0;
    let aveDays = 0;
    let nationalityPercentage = 0;
    

    await db.query(sql).then(res => {
        res.forEach(function(element){
            nationality.push(element.part1_mz);
            times.push(element.part1_zycs);
            days.push(element.part1_sjzyts);
            aveTimes += element.part1_zycs;
            aveDays += element.part1_sjzyts;
            if(element.part1_mz === '汉族') nationalityPercentage++;
        });
        let num = res.length;
        //console.log(num);
        aveTimes /= num;
        aveDays /= num;
        nationalityPercentage /= num;
        ctx.body = {...Tips[0],nationality:nationality,times:times,days:days,patientsNum:num,nationalityPercentage:nationalityPercentage,aveTimes:aveTimes,aveDays:aveDays};
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
module.exports = router;