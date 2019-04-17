const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const _ = require('lodash');

const form = {
    病案首页: 'SECOND_HOME',
    费用明细: 'SECOND_FEE',
}

const table = {
    SECOND_HOME:{
        key:"part1_bah"
    },
    SECOND_FEE:{
        key:"part2_bah"
    },
    SECOND_LIS:{
        key:"part3_OUTPATIENT_ID"
    },
    SECOND_PATHOLOGY:{
        key:"part4_bah"
    }
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
    console.log(conditions);
    conditions.forEach(item => {
        searchField.push(item.databaseField);
        logicValue.push(item.logicValue);
        Object.keys(form).forEach( i => {
            if(i === item.form_type){
                formType.push(form[i]);
            }
        })
        console.log(formType);

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
    
  
    console.log(searchField);
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
        sql1 = `SELECT ${unique(searchField)} FROM ${unique(formType)} where ${where} limit ${start},${pagesize};`;
        sql2 = `SELECT count(1) as num from (SELECT ${unique(searchField)}  FROM ${unique(formType)} where ${where}) as temp ;`;
    }else{
        sql1 = `SELECT part1_xm,part1_bah,part1_rysj,part1_ryzd,part1_pid FROM SECOND_HOME limit ${start},${pagesize};`
        sql2 = 'SELECT COUNT(*) FROM SECOND_HOME;'
    }

   console.log(sql1);
   console.log(sql2);
    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1, part2]).then((res) => {
        console.log(res);
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
        console.log(num);
        
        //Utils.cleanData(res);
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

module.exports = router;