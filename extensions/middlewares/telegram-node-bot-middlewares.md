# telegram-node-bot-middlewares

```sh
npm install git+https://github.com/bitrixhater/telegram-node-bot-middlewares.git --save
```

## Что это такое

Модуль представляет собой расширение обычного `TelegramBaseController` и добавляет возможность использовать «посредники» между запросом и командой.
В двух словах, это добавляет такие плюшки:
  - Теперь можно использовать `Promise` в методе `before` (конечно, можно было бы сделать просто как-нибудь так `$.before = new Promise(...)` и в обработчике команды что-то типа `$.before.then(errors => {...})`, но, короче, длывта ыдвлрваплдвапл ыдсжтыждвпв вжадп)
  - Теперь `before`-методы в нескольких контроллерах можно красиво оформить и построить реально сложную логику
  - Я вообще не знаю зачем я это сделал, но получилось прикольно, и мне нравится

## Зачем это нужно

Предположим, есть некий контроллер `LoginController` который обрабатывает команду `/login`. Также есть, например, контроллер `AccountController`, который обрабатывает `/bills` и `/profile`. И, конечно, `AdminController`, с командами `/ban` и `/stat`.
Пример кода (не запускал):

```JavaScript
class LoginController extends TelegramBaseController {
    before($) {
        $.chain = Promise.resolve($)
        .then(($) => {
            //логгируем в бд действие пользователя
        })
        .then(($) => {
            //проверяем не в бане ли он
        })
    }
    
    loginHandler($) {
        $.sendMessage('Введите свой пароль:')
        return $.waitForRequest
        .then(pass$ => {
            // если авторизация успешно завершена, то сохраняем данные об авторизации
        })
    }
    get routes() {
        return {
            'loginCommand': 'loginHandler'
        }
    }
}

class AccountController extends TelegramBaseController {
    before($) {
        $.chain = Promise.resolve($)
        .then(($) => {
            //логгируем в бд действие пользователя
        })
        .then(($) => {
            //проверяем не в бане ли он
        })
        .then(($) => {
            //проверка авторизации и продление сессии, если авторизован
        })
        return $
    }
    
    accountCommand($) {
        $.chain
        .then($ => {
            if ($.errors) return this.catch($)
            //.. выводим информацию об аккаунте
        })
    }
    
    billsCommand($) {
        $.chain
        .then($ => {
            if ($.errors) return this.catch($)
            //.. выводим информацию об аккаунте
        })
    }
    
    catch($) {
        // сообщения об ошибках
        $.sendMessage('- ' + $.errors.join('\n- '))
    }
    
    get routes() {
        return {
            'accountCommand': 'accountHandler',
            'billsCommand': 'billsHandler'
        }
    }
}

class AdminController extends TelegramBaseController {
    before($) {
        $.chain = Promise.resolve($)
        .then(($) => {
            //логгируем в бд действие пользователя
        })
        .then(($) => {
            //проверяем не в бане ли он
        })
        .then($ => {
            //проверка авторизации и продление сессии, если авторизован
        })
        .then($ => {
            //проверка на наличие прав администратора
        })
        return $
    }
    
    banHandler($) {
        $.chain
        .then($ => {
            if ($.errors) return this.catch($)
            //баним юзера
        })
    }
    
    statHandler($) {
        $.chain
        .then($ => {
            if ($.errors) return this.catch($)
            // возвращаем статистику бота
        })
    }
    
    catch($) {
        // сообщения об ошибках
        $.sendMessage('- ' + $.errors.join('\n- '))
    }
    
    get routes() {
        return {
            'banCommand': 'banHandler',
            'statCommand': 'statHandler'
        }
    }
}
```

Конечно, пример такой себе. Конечно, можно вынести всё в  глобальные функции, или отдельным в функции модулем, а потом в каждом файле контроллера `require`ить нужные функции и так далее... Ну тут всё примерно так и работает, только более красиво, по моему мнению, оформлено:
> В классе MiddlewareBaseController метода `before` нет, он заменён на `mwBefore` (добавлен, анологично, `mwAfter`)

```JavaScript
class CheckIsBannedMiddleware extends Middleware {
    //если требуется всего лишь одно действие, то можно юзать только handle, разрешаю
    handle($, resolve, reject) {
        $.getUserSession('isBanned')
        .then(isBanned => {
            if (isBanned) {
                return reject('У вас тут больше нет власти.')
            resolve($)
        })
    }
}

class AuthMiddleware extends Middleware {
    //а если требуется сделать несколько действий подряд, то можно их тут все указать их в get order(), который вовзращает массив с последовательностью нужных операций (я не знаю зачем, когда можно просто сделать `this.askfsd()`, но я уже сделал)
    isAuthorized($, resolve, reject) {
        $.getUserSession('authDate')
        .then(authDate => {
            if (authDate && ((authDate + 15 * 60 * 1000) < Date.now()))
                return reject('Вы бездействовали 15 минут, требуется авторизация.')
            resolve($)
        })
    }
    
    expandSession($, resolve, reject) {
        $.setUserSession('authDate', Date.now())
        resolve($)
    }
    
    get order() {
        return ['isAuthorized', 'expandSession']
    }
}

class CheckIsAdminMiddleware extends  Middleware {
    handle($, resolve, reject) {
        $.getChatSession('isAdmin')
        .then(isAdmin => {
            if (!isAdmin)
                return reject('У вас нет прав для выполнения этой команды!')
            resolve($)
        })
    }
}

class LogUserActionMiddleware extends Middleware {
    handle($, resolve, reject) {
        //как-нить логгируем
        resolve($)
    }
}

class ErrorPrinter extends MiddlewareCatcher {
    catch(err, $) {
        console.log('------------\nERROR\n------------', err, $)
        if (err instanceof Array)
            return $.sendMessage('При выполнении команды произошли слующие ошибки:\n- ' + err.join('\n- '))
        $.sendMessage('При выполнении команды произошла слующая ошибка:\n' + err)
    }
}

class LoginController extends TelegramBaseController {
    loginHandler($) {
        $.sendMessage('Введите свой пароль:')
        return $.waitForRequest
        .then(pass$ => {
            // если авторизация успешно завершена, то сохраняем данные об авторизации
        })
    }
    
    get routes() {
        return {
            'loginCommand': 'loginHandler'
        }
    }
}

class AccountController extends TelegramBaseController {
    accountCommand($, resolve) {
        //.. выводим информацию об аккаунте
    }
    
    billsCommand($) {
        //.. выводим информацию о платежах
    }
    
    get routes() {
        return {
            'accountCommand': 'accountHandler',
            'billsCommand': 'billsHandler'
        }
    }
}

class AdminController extends TelegramBaseController {
    banHandler($) {
        //баним юзера
    }
    
    statHandler($) {
        // возвращаем статистику бота
    }
    
    get routes() {
        return {
            'banCommand': 'banHandler',
            'statCommand': 'statHandler'
        }
    }
}

// посредники прикрепляются к контроллерам, поэтому их можно прикрепить след. образом:

// чтобы не плодить кучу инстансов каждый сделаем тут все
 let logUserActionMiddleware = new LogUserActionMiddleware()
 let checkIsBannedMiddleware = new CheckIsBannedMiddleware()
 let authMiddleware = new AuthMiddleware()
 let checkIsAdminMiddleware = new CheckIsAdminMiddleware()
 
tg.router
    .when(
        new TextCommand('login', 'loginCommand'),
        new LoginController()
        // можно прикрепить их вот так
        .middleware(logUserActionMiddleware, checkIsBannedMiddleware)
    )
    .when(
        [
            new TextCommand('account', 'accountCommand'),
            new TextCommand('bills', 'billsCommand'),
        ],
        new AccountController()
        // или вот так
        .middleware([
            logUserActionMiddleware,
            checkIsBannedMiddleware, 
            authMiddleware
        ])
    )
    .when(
        [
            new TextCommand('ban', 'banCommand'),
            new TextCommand('stat', 'statCommand'),
        ],
        new AccountController()
        // или вот так
        .middleware([logUserActionMiddleware],
                    checkIsBannedMiddleware,
                    [authMiddleware],
                    [checkIsAdminMiddleware])
    )
// на любой вкус и цвет, как говорится
```