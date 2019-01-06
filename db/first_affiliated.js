const type = {
    // part1
    home_page_type : [
        'VARCHAR(60)', 'INT', 'VARCHAR(300)', 'VARCHAR(60)', 'INT', 'INT', 'VARCHAR(300)', 'VARCHAR(300)', 'VARCHAR(300)',
        'VARCHAR(100)', 'VARCHAR(100)', 'VARCHAR(100)', 'VARCHAR(100)', 'VARCHAR(100)', 'VARCHAR(60)', 'VARCHAR(60)', 'INT', 'VARCHAR(300)',
        'VARCHAR(100)', 'VARCHAR(60)', 'VARCHAR(300)', 'INT', 'VARCHAR(60)'
    ],

    //part2
    advice_page_type : [
        'VARCHAR(60)', 'VARCHAR(60)', 'VARCHAR(150)', 'INT', 'DECIMAL(10 ,2)', 'VARCHAR(60)', 'VARCHAR(30)', 'VARCHAR(30)', 'VARCHAR(60)',
        'VARCHAR(30)', 'VARCHAR(60)', 'VARCHAR(60)', 'VARCHAR(60)', 'VARCHAR(60)'
    ],

    //part3
    lis_page_type: [
        'VARCHAR(90)', 'INT', 'VARCHAR(60)', 'INT', 'VARCHAR(150)', 'VARCHAR(150)', 'VARCHAR(90)', 'VARCHAR(60)', 'VARCHAR(300)', 'VARCHAR(60)'
    ],

    //part4
    operation_mazui_type: [
        'V6', 'V30', 'V12', 'V3', 'V3', 'V3', 'V3', 'V3', 'V3', 'V3', 'V3', 'V3', 'V3', 'V3'
    ],

    //part5
    result_type: [
        'I', 'V9', 'V3', 'V30', 'V3', 'T', 'T'
    ],
    generateType: function (type) {
        switch (type) {
            case 'I':
                return 'INT';
            case 'V6':
                return 'VARCHAR(60)';
            case 'V12':
                return 'VARCHAR(120)';
            case 'V30':
                return 'VARCHAR(300)';
            case 'V3':
                return 'VARCHAR(30)';
            case 'V9':
                return 'VARCHAR(90)';
            case 'T':
                return 'TEXT';
            default:
                return type;
        }
    }
};



module.exports = {
    type
};