(function (ext) {

    var embeditAppID = "dbhfnkcnljcbbpocflmbfcobkmagpgpf";
    //port connecting to chrome app
    var hPort;
    //connection status
    var currentStatus = 0;
    var isDuo;
    //sensor info
    var circuitData = new Array(32);

    // currently the chrome app is not working on mac, so I use this to mock the circuitData
    circuitData = [3, 4, 3, 11, 13, 83, 80, 0, 0, 1, 212, 56, 102, 0, 0, 0, 0, 0, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null];

    var prevXYZ = {};
    var prevTime = new Date();

    var CIRCUIT = {
        SWITCH: 9,
        CAPSENSE: [0, 1, 2, 3],
        BUTTONS: [7, 8],
        SENSORS: {
            LIGHT: 4,
            MICROPHONE: 5,
            TEMPERATURE: 6,
            ACCELEROMETER: {
                X: 10,
                Y: 11,
                Z: 12
            }
        },
        ANALOG: {
            PIN9: 13,
            PIN10: 14,
            PIN12: 15
        }
    };



    function setNeopixelRGB(lednum, r, g, b) {

        hPort.postMessage({
            message: "O".charCodeAt(0),
            lednum: lednum,
            red: r,
            green: g,
            blue: b
        });

        console.log("setNeopixelRGB: " + lednum);

    }

    function setNeopixelHex(lednum, hex) {
        var color = hexToRgb(hex);
        setNeopixelRGB(lednum, color.r, color.g, color.b);
    }

    function setNeopixelColor(lednum, color) {
        var hex = decimalColorToHex(color);
        setNeopixelHex(lednum, hex);
    }

    function normalizeAnalog(value) {
        // the given value is between 0 and 255
        return (value * 100 / 255).toFixed(2);
    }


    var isInititalized = false;
    //gets the connection status fo the circuit playground
    var getCircuitPlaygroundStatus = function () {
        chrome.runtime.sendMessage(embeditAppID, {message: "STATUS"}, function (response) {

            //Chrome app not found
            if (response === undefined) {
                console.log("Chrome app not found");
                currentStatus = 0;
                //setTimeout(getCircuitPlaygroundStatus, 2000);
                isInititalized = false;
                return;
            }

            //Chrome app says not connected
            if (response.status === false) {
                //console.log("Not connected");
                //hPort = chrome.runtime.connect(embeditAppID);
                //hPort.onMessage.addListener(onMsgCircuitPlayground);
                isInititalized = false;

                currentStatus = 1;
            }

            // successfully connected
            else if (response.status === true) {

                if (!isInititalized) {
                    console.log("Connected");
                    isDuo = response.duo;
                    console.log("isDuo: " + isDuo);
                    hPort = chrome.runtime.connect(embeditAppID);

                    hPort.onMessage.addListener(function (msg) {
                        circuitData = msg;
                    });

                    currentStatus = 2;

                    isInititalized = true;
                }
            }

        });
    };

    setInterval(getCircuitPlaygroundStatus, 1000);

    // getCircuitPlaygroundStatus();


    ext._getStatus = function () {

        switch(currentStatus){
            case 0:{
                if (!elementExists('#app-not-connected-popup')) {
                    var popupElm = "<div id=\'app-not-connected-popup\'\n     style=\'position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,0.8);display: flex; justify-content: center; align-items: center;\'>\n\n\n    <div style=\'color:gray;  margin:10%; background:white;border-radius: 4px; box-shadow:0 2px 2px rgba(0,0,0,0.5); text-align: center;\'>\n\n        <header style=\'background: #607D8B; padding: 10px; border-radius: 4px 4px 0 0 \'>\n            <span style=\'color:#ffffff; font-size:150%;\'>App Not Connected</span>\n        </header>\n\n        <div style=\'padding:20px;\'>\n\n            Please\n            <a\n                    href=\'https://chrome.google.com/webstore/detail/dbhfnkcnljcbbpocflmbfcobkmagpgpf\'\n                    target=\'_blank\'\n                    style=\'background: #4CAF50; color: white; font-weight: bold; text-transform: uppercase; padding: 2px 20px; border-radius: 4px; border-bottom: 2px solid #2E7D32; cursor: pointer;\'>click\n                here</a> to install and launch the <em>Embedit Scratch Connection App</em> and then <strong> check back\n            here.</strong>\n\n            <img src=\"https://media.giphy.com/media/26xBMKr8SJsuikHcI/giphy.gif\"\n                 style=\'display: block;height:100px;margin:20px auto\'>\n\n        </div>\n\n    </div>\n</div>";
                    $('body').append(popupElm);
                }

                return {status: 1, msg: 'Chrome App Not Connected'};
            }

            case 1:{
                 $('#app-not-connected-popup').remove();
                 return {status: 1, msg: 'Circuit Playground Not Connected'};
            }

           case 2:{
                 $('#app-not-connected-popup').remove();
                return {status: 2, msg: 'Connected'};
            }


        }

    };

    ext._shutdown = function () {
        //sends disconnect 
        var report = {message: "R".charCodeAt(0)};
        hPort.postMessage(report);
    };

    ext.isShaking = function () {

        var res = false;

        var threshold = 15; //default velocity threshold for shake to register
        var timeout = 1000; //default interval between events

        var current = {
            x: circuitData[CIRCUIT.SENSORS.ACCELEROMETER.X],
            y: circuitData[CIRCUIT.SENSORS.ACCELEROMETER.Y],
            z: circuitData[CIRCUIT.SENSORS.ACCELEROMETER.Z]
        };

        // For the first time
        if ((prevXYZ.x === null) && (prevXYZ.y === null) && (prevXYZ.z === null)) {
            prevXYZ.x = current.x;
            prevXYZ.y = current.y;
            prevXYZ.z = current.z;
            return;
        }

        var deltaX = Math.abs(prevXYZ.x - current.x);
        var deltaY = Math.abs(prevXYZ.y - current.y);
        var deltaZ = Math.abs(prevXYZ.z - current.z);

        if (((deltaX > threshold) && (deltaY > threshold)) || ((deltaX > threshold) && (deltaZ > threshold)) || ((deltaY > threshold) && (deltaZ > threshold))) {
            //calculate time in milliseconds since last shake registered
            var currentTime = new Date();
            var timeDifference = currentTime.getTime() - prevTime.getTime();

            if (timeDifference > timeout) {
                res = true;
                prevTime = new Date();
            }
        }

        prevXYZ.x = current.x;
        prevXYZ.y = current.y;
        prevXYZ.z = current.z;

        return res;

    };

    ext.getLoudness = function () {
        return normalizeAnalog(circuitData[CIRCUIT.SENSORS.MICROPHONE]);
    };

    ext.getBrightness = function () {
        return normalizeAnalog(circuitData[CIRCUIT.SENSORS.LIGHT]);
    };

    ext.getTemperature = function () {
        return normalizeAnalog(circuitData[CIRCUIT.SENSORS.TEMPERATURE]);
    };

    ext.getAcc = function (axis) {
        return normalizeAnalog(circuitData[CIRCUIT.SENSORS.ACCELEROMETER[axis]]);
    };

    ext.getSwitch = function () {
        //returns switch status
        return circuitData[CIRCUIT.SWITCH];
    };

    ext.getCap = function (port) {
        var CAP_THRESHOLD = 80;
        return circuitData[port] > CAP_THRESHOLD;
    };

    ext.when = function (b) {
        return b();
    };

    ext.isButtonPressed = function (buttonIndex) {
        return circuitData[CIRCUIT.BUTTONS[buttonIndex - 1]];
    };

    ext.turnLedOff = function (lednum) {
        setNeopixelHex(lednum, '#000000');
    };

    ext.turnAllLedsOff = function () {

        for (var i = 0; i < 10; i++) {
            setNeopixelHex(i, '#000000');
        }
    };

    ext.setNeopixelRGB = setNeopixelRGB;

    ext.setNeopixelColor = setNeopixelColor;

    // ANALOG

    ext.readAnalog = function (pin) {
        return normalizeAnalog(circuitData[CIRCUIT.ANALOG["PIN" + pin]]);
    };

    ext.setAnalogPinRW = function (pin, state) {

        var servo_num = (pin == 9) ? 1 : 2; // Servo#1 is on pin#9 , Servo#2 is on pin#10
        var servo_setup = (state == 'read') ? 0 : 1; // 0:read , 1:servo

        var report = {
            message: "s".charCodeAt(0),
            servo_num: servo_num,
            servo_setup: servo_setup
        };

        hPort.postMessage(report);

    };

    ext.setServo = function (pin, angle) {

        var servo_num = (pin == 9) ? 1 : 2; // Servo#1 is on pin#9 , Servo#2 is on pin#10
        angle %= 180;

        var report = {
            message: "S".charCodeAt(0),
            servo_num: servo_num,
            angle: angle
        };

        hPort.postMessage(report);

    };

    var LOCALIZATION_STRINGS = {
        en: {
            levels: [
                {
                    blocks: {
                        whenButtonPressed: 'button %m.buttons pressed',
                        isButtonPressed: 'button %m.buttons pressed?',
                        getSwitch: 'switch?',
                        setNeopixelColor: 'set led %n to %c',
                        setNeopixelRGB: 'set led %n to ( R:%n , G:%n , B:%n )',
                        turnLedOff: 'turn led %n off',
                        turnAllLedsOff: 'turn all leds off',
                        getAcc: 'accelerometer %m.axis',
                        getLoudness: 'loudness',
                        getBrightness: 'brightness',
                        getTemperature: 'temperature',
                        isShaking: 'shaking?',
                        whenShaking: 'when shaking'
                    },
                    menus: {
                        digital: {on: 'on', off: 'off'}
                    }
                },
                {
                    blocks: {
                        setAnalogPinRW: 'setup pin %m.analog_servo_pins to %m.analog_pin_state',
                        readAnalog: 'analog pin %m.analog_pins',
                        setServo: 'set servo on pin %m.analog_servo_pins to angle %n'
                    },
                    menus: {
                        analog_pin_state: {read: 'read', servo: 'servo'},
                    }
                }
            ]
        },

        ar: {
            levels: [
                {
                    blocks: {
                        whenButtonPressed: 'ar - button %m.buttons pressed',
                        isButtonPressed: 'ar - button %m.buttons pressed?',
                        getSwitch: 'ar - switch?',
                        setNeopixelColor: 'ar - set led %n to %c',
                        setNeopixelRGB: 'ar - set led %n to ( R:%n , G:%n , B:%n )',
                        turnLedOff: 'ar - turn led %n off',
                        turnAllLedsOff: 'ar - turn all leds off',
                        getAcc: 'ar - accelerometer %m.axis',
                        getLoudness: 'ar - loudness',
                        getBrightness: 'ar - brightness',
                        getTemperature: 'ar - temperature',
                        isShaking: 'ar - shaking?',
                        whenShaking: 'ar - when shaking'
                    },
                    menus: {
                        digital: {on: 'on', off: 'off'},
                    }
                },
                {
                    blocks: {
                        setAnalogPinRW: 'ar - setup pin %m.analog_servo_pins to %m.analog_pin_state',
                        readAnalog: 'ar - analog pin %m.analog_pins',
                        setServo: 'ar - set servo on pin %m.analog_servo_pins to angle %n'
                    },
                    menus: {
                        analog_pin_state: {read: 'read', servo: 'servo'},
                    }
                }
            ]
        }

    };

    var level_param = (new URLSearchParams(window.location.search)).get('level') || 1;
    var lang_param = (new URLSearchParams(window.location.search)).get('lang') || 'en';

    document.title = "Scratchduino - Level #" + level_param;


    var current_level_index = level_param - 1; // Root level is 0


    var strings = LOCALIZATION_STRINGS[lang_param].levels[0];


    // Add the base blocks (level 0)
    var levels = [{
        blocks: [
            ['h', strings.blocks["whenButtonPressed"], 'isButtonPressed', 1],
            ['b', strings.blocks["isButtonPressed"], 'isButtonPressed', 1],
            ['b', strings.blocks["getSwitch"], 'getSwitch'],
            [' ', strings.blocks["setNeopixelColor"], 'setNeopixelColor', 1, '#ff0000'],
            [' ', strings.blocks["setNeopixelRGB"], 'setNeopixelRGB', 1, 255, 0, 0],
            [' ', strings.blocks["turnLedOff"], 'turnLedOff', 1],
            [' ', strings.blocks["turnAllLedsOff"], 'turnAllLedsOff'],
            ['r', strings.blocks["getAcc"], 'getAcc', 'X'],
            ['r', strings.blocks["getLoudness"], 'getLoudness'],
            ['r', strings.blocks["getBrightness"], 'getBrightness'],
            ['r', strings.blocks["getTemperature"], 'getTemperature'],
            ['h', strings.blocks["whenShaking"], 'isShaking'],
            ['b', strings.blocks["isShaking"], 'isShaking'],
        ],
        menus: {
            buttons: [1, 2],
            digital: [strings.menus.digital['on'], strings.menus.digital['off']],
            axis: ['X', 'Y', 'Z']
        }
    }];


    // Add the translations of the level blocks
    if(current_level_index > 0){
        Object.assign(strings.blocks, LOCALIZATION_STRINGS[lang_param].levels[current_level_index].blocks);
        Object.assign(strings.menus, LOCALIZATION_STRINGS[lang_param].levels[current_level_index].menus);
    }

    // Add the additonal blocks of the selected level
    switch(current_level_index){
        case 1:{
            levels.push({
                blocks: [
                    [' ', strings.blocks["setAnalogPinRW"], 'setAnalogPinRW', 9, 'servo'],
                    ['r', strings.blocks["readAnalog"], 'readAnalog', 9],
                    [' ', strings.blocks["setServo"], 'setServo', 9, 90]
                ],
                menus: {
                    analog_pins: [9, 10, 12],
                    analog_servo_pins: [9, 10],
                    analog_pin_state: [strings.menus.analog_pin_state['read'], strings.menus.analog_pin_state['servo']]
                }
             });
        }
        break;
    }

	
	// Level 0 is the root level
	var blocks = levels[0].blocks;
	var menus = levels[0].menus;

    if(current_level_index > 0){
    	//blocks = blocks.concat(levels[current_level_index].blocks);

    	Array.prototype.push.apply(blocks, levels[current_level_index].blocks);
    	Object.assign(menus, levels[current_level_index].menus);
    }

    var descriptor = {
        blocks: blocks,
        menus: menus,
        url: 'http://www.embeditelectronics.com/blog/learn/'
    };


    ScratchExtensions.register('Circuit Playground', descriptor, ext);


    // *********************************************************************************
    // HELPER FUNCTIONS ****************************************************************
    // *********************************************************************************

    function elementExists(id) {
        return $(id).length > 0;
    }


    //convert scratch hex color to rgb for neopixels
    function hexToRgb(hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function (m, r, g, b) {
            return r + r + g + g + b + b;
        });

        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function decimalColorToHex(number) {
        return "#" + ((number) >>> 0).toString(16).slice(-6);
    }


})({});
