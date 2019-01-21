const type = {
    // 首页part1， 收费part2


    // part3
    lis_type : [
        'VARCHAR(30)', 'VARCHAR(90)', 'INT', 'INT', 'INT', 'VARCHAR(30)', 'VARCHAR(90)', 'VARCHAR(300)', 'VARCHAR(300)'
        ,'VARCHAR(90)', 'VARCHAR(30)'
    ],
    // 病理表
    pathology_type : [
        'VARCHAR(30)','INT','VARCHAR(30)','VARCHAR(90)','VARCHAR(90)','VARCHAR(30)','VARCHAR(10)','VARCHAR(30)','VARCHAR(10)',
        'INT','VARCHAR(30)','VARCHAR(10)','VARCHAR(10)','VARCHAR(30)','VARCHAR(30)','VARCHAR(30)','VARCHAR(30)','VARCHAR(30)',
        'VARCHAR(300)','VARCHAR(30)','INT','VARCHAR(300)','VARCHAR(300)','VARCHAR(300)','VARCHAR(300)','VARCHAR(300)'
    ]
};

const key = {
    // 病理表
    pathology_key : [
        'hzxm','bah','blzdh','blrq','jbzd','zldx','t','lbjsl','n','yczyyw','yczywz','m','tnmfq','er','pr','her2','her2fish','ki67','bljgmyzhjgbz',
        'fzfx','xfzzl','xfzzlfa','xfzzlzq','xfzzlpg1','xfzzlpg2','xfzzlpg3'
    ]
};

module.exports = {
    type,
    key
};