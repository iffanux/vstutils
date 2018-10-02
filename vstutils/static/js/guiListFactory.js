
var gui_list_object = {
    state : {
        search_filters:{}
    },
    init : function (page_options, url_vars = undefined, object_data = undefined)
    {
        this.base_init.apply(this, arguments)

        this.activeSearch = {
            filters: {},
            fields: {}
        }
        
        if(object_data)
        {
            this.model.data = object_data
            this.model.status = 200
        }
    },

    deleteArray : function (ids)
    {
        var thisObj = this;
        var def = new $.Deferred();
        var q = []

        if(guiSchema.object[thisObj.api.name])
        {
            for(let i in ids)
            {
                q.push({
                    type:"del",
                    item: thisObj.api.bulk_name,
                    pk:ids[i]
                })
            }
        }
        else
        {
            let parent_type = spajs.urlInfo.data.reg.parent_type;
            let parent_id = spajs.urlInfo.data.reg.parent_id;
            let page_type = spajs.urlInfo.data.reg.page_type;
            for(let i in ids)
            {
                q.push({
                    type:"mod",
                    method:"delete",
                    data_type:[parent_type, parent_id, page_type, ids[i]],
                })
            }

        }

        $.when(api.query(q)).done(function(data)
        {
            guiPopUp.success("Objects of '"+thisObj.api.bulk_name+"' type were successfully deleted");
            def.resolve(data)
        }).fail(function (e)
        {
            def.reject(e)
            webGui.showErrors(e)
        })

        return def.promise();
    },

    prefetch : function (data)
    {
        var prefetch_fields = {};
        var prefetch_fields_ids = {};
        var promise = new $.Deferred();

        //отбираем prefetch поля
        for(var i in this.api.schema.list.fields)
        {
            if(this.api.schema.list.fields[i].prefetch)
            {
                prefetch_fields[this.api.schema.list.fields[i].name] = $.extend(true, {}, this.api.schema.list.fields[i].prefetch);
                prefetch_fields_ids[this.api.schema.list.fields[i].name] = {};
            }
        }

        //если prefetch полей не оказалось, то функция завершает свое выполнение
        if($.isEmptyObject(prefetch_fields))
        {
            return promise.resolve(data);
        }

        var dataFromApi = data.data.results;

        //отбираем id prefetch полей
        for(var item in dataFromApi)
        {
            for(var field in dataFromApi[item])
            {
                if(prefetch_fields[field])
                {
                    if(!prefetch_fields_ids.hasOwnProperty(field))
                    {
                        prefetch_fields_ids[field] = {};
                    }

                    let path = prefetch_fields[field].path(dataFromApi[item]);

                    if(path)
                    {
                        if(!prefetch_fields_ids[field].hasOwnProperty(path))
                        {
                            prefetch_fields_ids[field][path] = [];
                        }

                        if($.inArray(dataFromApi[item][field], prefetch_fields_ids[field][path]) == -1 && dataFromApi[item][field] != null )
                        {
                            prefetch_fields_ids[field][path].push(dataFromApi[item][field]);
                        }
                    }
                }
            }
        }


        var bulkArr = [];
        var queryObj = {};

        //формируем bulk запрос
        for(var field in prefetch_fields_ids)
        {
            for(var path in prefetch_fields_ids[field])
            {

                let match = path.match(/(?<parent_type>[A-z]+)\/(?<parent_id>[0-9]+)\/(?<page_type>[A-z\/]+)$/);
                if(match != null)
                {
                    queryObj = {
                        type: "mod",
                        item: match[1].replace(/^\/|\/$/g, ''),
                        pk: match[2].replace(/^\/|\/$/g, ''),
                        data_type: match[3].replace(/^\/|\/$/g, ''),
                        method: "get",
                    }
                }
                else
                {
                    let bulk_name = path.replace(/\{[A-z]+\}\/$/, "").toLowerCase().match(/\/([A-z0-9]+)\/$/);
                    queryObj = {
                        type: "mod",
                        item: bulk_name[1],
                        filters:"id="+prefetch_fields_ids[field][path].join(","),
                        method:"get",
                    }
                }

                bulkArr.push(queryObj);
            }
        }

        //отправляем bulk запрос
        $.when(api.query(bulkArr)).done(d =>
        {
            for(var item in dataFromApi)
            {
                for(var field in dataFromApi[item])
                {
                    if(prefetch_fields[field])
                    {
                        let path = prefetch_fields[field].path(dataFromApi[item]);

                        if(path)
                        {
                            let match = path.match(/(?<parent_type>[A-z]+)\/(?<parent_id>[0-9]+)\/(?<page_type>[A-z\/]+)$/);
                            if(match != null)
                            {
                                for(var j in d)
                                {
                                    if(d[j].item == match[1].replace(/^\/|\/$/g, '') && d[j].subitem == match[3].replace(/^\/|\/$/g, ''))
                                    {
                                        let prefetch_data = d[j].data.results;
                                        for(var k in prefetch_data)
                                        {
                                            if($.inArray(prefetch_data[k].id, prefetch_fields_ids[field][path]) != -1)
                                            {
                                                dataFromApi[item][field+'_info'] = prefetch_data[k];
                                            }
                                        }
                                    }
                                }
                            }
                            else
                            {
                                let bulk_name = path.replace(/\{[A-z]+\}\/$/, "").toLowerCase().match(/\/([A-z0-9]+)\/$/);
                                for(var j in d)
                                {
                                    if(d[j].item == bulk_name[1])
                                    {
                                        let prefetch_data = d[j].data.results;
                                        for(var k in prefetch_data)
                                        {
                                            if(dataFromApi[item][field] == prefetch_data[k].id)
                                            {
                                                dataFromApi[item][field+'_info'] = prefetch_data[k];
                                            }
                                        }
                                    }
                                }

                            }
                        }
                    }
                }
            }

            promise.resolve(data);
        }).fail(f => {
            promise.reject(f);
        })

        return promise.promise();

    },

    /**
     * Функция загрузки данных
     * @returns {jQuery.ajax|spajs.ajax.Call.defpromise|type|spajs.ajax.Call.opt|spajs.ajax.Call.spaAnonym$10|Boolean|undefined|spajs.ajax.Call.spaAnonym$9}
     */
    load : function (filters)
    {
        if (!filters)
        {
            filters = {};
        }

        if (!filters.limit)
        {
            filters.limit = 20;
        }

        if (!filters.offset)
        {
            filters.offset = 0;
        }

        /*if (!filters.ordering)
        {
            filters.ordering = "desc";
        }*/
      
        if (filters.page_number)
        {
            filters.offset = (filters.page_number-1)/1*filters.limit;
        }

        var q = [];

        q.push("limit=" + encodeURIComponent(filters.limit))
        q.push("offset=" + encodeURIComponent(filters.offset))
        //q.push("ordering=" + encodeURIComponent(filters.ordering))
       
        if(filters.search_query)
        {
            if(typeof filters.search_query == "string")
            {
                filters.search_query = this.searchStringToObject(filters.search_query)
            }

            for (var i in filters.search_query)
            {
                if (Array.isArray(filters.search_query[i]))
                {
                    for (var j in filters.search_query[i])
                    {
                        filters.search_query[i][j] = encodeURIComponent(filters.search_query[i][j])
                    }
                    q.push(encodeURIComponent(i) + "=" + filters.search_query[i].join(","))
                    continue;
                }
                q.push(encodeURIComponent(i) + "=" + encodeURIComponent(filters.search_query[i]))
            }
        }

        let url = this.api.path
        if(this.url_vars)
        {
            for(let i in this.url_vars)
            {
                if(/^api_/.test(i))
                {
                    url = url.replace("{"+i.replace("api_", "")+"}", this.url_vars[i])
                }
            }
        }

        url = url.replace(/^\/|\/$/g, "").split(/\//g)
        let queryObj = {
            //type:'mod',
            data_type:url,
            filters:q.join("&"),
            method:'get'
        }

        var promise = new $.Deferred();

        $.when(api.query(queryObj)).done(d => {

            $.when(this.prefetch(d)).always(a => {
                promise.resolve(a);
            });

        }).fail(f => {
            promise.reject();
        })

        return promise.promise();
    },

    toggleSelectEachItem : function (tag, mode)
    {
        if(!mode)
        {
            window.guiListSelections.unSelectAll(tag)
            return false;
        }

        let filters = this.model.filters

        filters.limit = 9999999
        filters.offset = 0;
        filters.page_number = 0;

        return $.when(this.load(filters)).done(function(data)
        {
            if(!data || !data.data || !data.data.results)
            {
                return;
            }

            let ids = []
            for(let i in data.data.results)
            {
                ids.push(data.data.results[i].id)
            }

            window.guiListSelections.setSelection(tag, ids, mode);
        }).promise()
    },

    create : function ()
    {
        var thisObj = this;
        var res = this.sendToApi(this.api.methodAdd)
        $.when(res).done(function()
        {
            guiPopUp.success("New object in "+thisObj.api.bulk_name+" was successfully created");
        })
        return res;
    },
 
    renderLine : function (line, opt = {})
    {  
        let tpl = this.getTemplateName('list_line')
        
        line.sublinks_l2 = this.api.sublinks_l2;
        
        let dataLine = {
            line:line,
            sublinks_l2:this.api.sublinks_l2,
            opt:opt,
            rendered:{}
        }
        
        tabSignal.emit("guiList.renderLine",  {guiObj:this, dataLine: dataLine});
        tabSignal.emit("guiList.renderLine."+this.api.bulk_name,  {guiObj:this, dataLine: dataLine});
       
        return spajs.just.render(tpl, {guiObj: this, dataLine: dataLine});
    },
    
    /**
     * Функция должна вернуть или html код блока или должа пообещать чтол вернёт html код блока позже
     * @returns {string|promise}
     */
    renderAsPage : function (render_options = {})
    {
        let tpl = this.getTemplateName('list')

        render_options.fields = this.api.schema.list.fields
        render_options.base_path = getUrlBasePath()

        //render_options.sections = this.getSections('renderAsPage')
        if(!render_options.page_type) render_options.page_type = 'list'

        render_options.selectionTag =  this.api.selectionTag
        window.guiListSelections.intTag(render_options.selectionTag)
       
        return spajs.just.render(tpl, {query: "", guiObj: this, opt: render_options});
    },

    /**
     * Функция должна вернуть или html код блока или должа пообещать что вернёт html код блока позже
     * @returns {string|promise}
     */
    renderAsNewPage : function (render_options = {})
    {
        let tpl = this.getTemplateName('new')

        render_options.fields = this.api.schema.new.fields
        //render_options.sections = this.getSections('renderAsNewPage')
        render_options.hideReadOnly = true

        render_options.base_path = getUrlBasePath()
        return spajs.just.render(tpl, {query: "", guiObj: this, opt: render_options});
    },

    /**
     * Функция должна вернуть или html код блока или должа пообещать чтол вернёт html код блока позже
     * @returns {string|promise}
     */
    renderAsAddSubItemsPage : function (render_options = {})
    {
        let tpl = this.getTemplateName('list_add_subitems')

        render_options.fields = this.api.schema.list.fields
        render_options.base_path = getUrlBasePath()
        //render_options.sections = this.getSections('renderAsAddSubItemsPage')

        render_options.selectionTag =  this.api.selectionTag+"_add"
        window.guiListSelections.intTag(render_options.selectionTag)
 
        render_options.base_path = getUrlBasePath()
        return spajs.just.render(tpl, {query: "", guiObj: this, opt: render_options});
    },
   
   
    /**
     * Добавить фильтр
     * @param {string} name
     * @param {string} value
     */
    addSearchFilter : function(name, value)
    {
        this.activeSearch.active = ""
        $('#search-query-input').val('')

        this.activeSearch.fields[name].used = true

        for(var i in this.activeSearch.filters)
        {
            var val = this.activeSearch.filters[i]
            if(val.name == name)
            {
                if(!this.activeSearch.fields[name].isArray || this.activeSearch.filters[i].value == value)
                {
                    this.activeSearch.filters[i].value = value
                    return;
                }
            }
        }

        this.activeSearch.filters.push({
            name:name,
            value:value
        })
    },

    /**
     * Выбрать фильтра, чтоб начать вводить значение фильтра
     * @param {string} name
     */
    selectSearchFilter : function(name)
    {
        this.activeSearch.active = name
        $('#search-query-input').val('')
    },

    /**
     * Удалить фильтр
     * @param {string} name
     */
    onRemoveSearchFilter : function(name)
    {
        for(var i in this.activeSearch.filters)
        {
            if(this.activeSearch.filters[i] == undefined || this.activeSearch.filters[i].name == name)
            {
                this.activeSearch.filters.splice(i, 1)
                break;
            }
        }
        this.activeSearch.fields[name].used = false

        return this.searchGO(this.searchObjectToString(""), this.searchAdditionalData);
    },

    /**
     * Ввод текста в поисковую строку
     * @param {Object} options параметры
     * @return {string} HTML поля ввода для поиска
     */
    renderSearchForm : function ()
    {  
        let searchString = ""
        
        if(this.url_vars && this.url_vars.search_part)
        {
            searchString = this.url_vars.search_part.replace("/search/", "");
        }
        
        this.activeSearch = {
            filters:[],
            fields: {}
        }
        
        for(let i in this.api.schema.list.filters)
        {
            let val = this.api.schema.list.filters[i]
            /*let key = val.name.replace("__in", "").replace("__contains", "").replace("__not", "")
            // Переменная не встречается в списке допустимых фильтров 
            if(!this.api.schema.list.fields[key])
            {
                console.warn("Переменная `"+key+"` не встречается в списке допустимых фильтров", this.api.schema.list.fields)
                debugger;
                continue;
            }*/
 
            this.activeSearch.fields[val.name] = val
            this.activeSearch.fields[val.name].value = ""
        }
        
        
        /*
        return spajs.just.render('search_field', {guiObj: this, opt:{query:""}}) */
        
        
        var thisObj = this;
        //options.className = this.model.className;
        this.searchAdditionalData = {}// options
        //options.thisObj = this;

        this.activeSearch.active = ""
       
        var search = this.searchStringToObject(searchString, undefined, true)
        var searchfilters = []
        for(var i in search)
        {
            var key = i.replace(/(__contains|__in)/mgi, "")
            if(this.activeSearch.fields[key])
            {
                searchfilters.push({
                    name:key,
                    value:search[i]
                })

                this.activeSearch.fields[key].used = true
            }
        }
        this.activeSearch.filters = searchfilters
       
        return spajs.just.render('search_field', {guiObj: this, opt:{query:""}}, () =>
        {
            new autoComplete({
                selector: '#search-query-input',
                minChars: 0,
                cache:false,
                showByClick:true,
                menuClass:".autocomplete-suggestion",
                renderItem: function(item, search)
                {
                    var name = item.name
                    if(item.title != undefined)
                    {
                        name = item.title
                    }
                    name = name + " ="
                    name = name.replace("__not =", " != ")
                    
                    
                    return '<div class="autocomplete-suggestion"  data-value="' + item.name + '" >' + name + '</div>';
                },
                onSelect: (event, term, item) =>
                {
                    var value = $(item).attr('data-value')
                    if(!this.activeSearch.active)
                    {
                        this.selectSearchFilter(value)
                    }
                    else
                    {
                        this.addSearchFilter(this.activeSearch.active, value)
                        setTimeout(() =>{
                            spajs.showLoader(this.searchGO('', this.searchAdditionalData))
                        }, 0)
                    }
                },
                source: (term, response) =>
                {  
                    term = term.toLowerCase();
                   
                    var matches = []

                    if(!this.activeSearch.active)
                    {
                        for(var i in this.activeSearch.fields)
                        {
                            var val = this.activeSearch.fields[i]
                            if( (!val.used || val.isArray) && val.name.toLowerCase().indexOf(term) == 0)
                            { 
                                matches.push(val)
                            }
                        }
                    }
                    else if(this.activeSearch.fields[this.activeSearch.active])
                    {
                        var activeOption = this.activeSearch.fields[this.activeSearch.active]
                        if(activeOption.options)
                        {
                            for(var i in activeOption.options)
                            {
                                var val = activeOption.options[i]
                                if(val.toLowerCase().indexOf(term) != -1)
                                {
                                debugger;
                                    matches.push({name:val})
                                }
                            }
                        }
                    }

                    if(matches && matches.length)
                    {
                        response(matches);
                    }
                }
            });
        }); 
    },
  
    /**
     * Функция поиска
     * @returns {jQuery.ajax|spajs.ajax.Call.defpromise|type|spajs.ajax.Call.opt|spajs.ajax.Call.spaAnonym$10|Boolean|undefined|spajs.ajax.Call.spaAnonym$9}
     */
    search : function (filters)
    {
        var thisObj = this;
        this.model.filters = filters
     
        var def = this.load(filters)
        $.when(def).done(function(data){
            thisObj.model.data = data.data
        })

        return def
    },
    
    /**
     * Выполняет переход на страницу с результатами поиска
     * @param {string} query
     * @returns {$.Deferred}
     */
    searchGO : function (query, options)
    {
        if (this.isEmptySearchQuery(query))
        {
            return vstGO(this.url_vars.baseURL());
        }

        return vstGO(this.url_vars.searchURL(this.searchObjectToString(trim(query)))) 
    },

    /**
     * Если поисковый запрос пуст, то вернёт true
     * @param {type} query
     * @returns {Boolean}
     */
    isEmptySearchQuery : function (query)
    {
        if (!query || !trim(query)
            && this.activeSearch 
            && this.activeSearch.filters 
            && this.activeSearch.filters.length == 0)
        {
            return true;
        }

        return false;
    },
  
    onSearchInput : function(event, input)
    {
        var value = input.value 
        if(event.key == "Backspace" && value.length == 0)
        {
            if(input.getAttribute('data-backspace') == "true")
            {
                input.setAttribute('data-backspace', "false")
                this.activeSearch.active = ""
                $('#search-query-input').val('')
            }
            else
            {
                input.setAttribute('data-backspace', "true")
            }
        }

        if(/[: ]$/mgi.test(value) && !this.activeSearch.active)
        {
            value = value.substr(0, value.length-1)
            if(this.activeSearch.fields[value])
            {
                this.selectSearchFilter(value)
            }
        }
        else if(/[: ]$/mgi.test(value) && this.activeSearch.active)
        {
            value = value.substr(0, value.length-1)
            this.addSearchFilter(this.activeSearch.active, value)
            spajs.showLoader(this.searchGO('', this.searchAdditionalData))
            return
        }

        if(event.keyCode == 13)
        {
            spajs.showLoader(this.searchGO(value, this.searchAdditionalData))
        }
    },
  
    /**
     * Преобразует строку и объект поиска в строку для урла страницы поиска
     * @param {string} query строка запроса
     * @param {string} defaultName имя параметра по умолчанию
     * @returns {string} строка для параметра страницы поиска
     */
    searchObjectToString : function(query, defaultName)
    {
        var isAddedDefaultValue = false;
        if(!defaultName)
        {
            defaultName = 'name'
        }

        if(this.activeSearch.active)
        {
            defaultName = this.activeSearch.active
        }

        var defaultValue = undefined
        if(query != "" && query.indexOf("=") == -1)
        {
            defaultValue = query;
        }
        else if(query.indexOf("=") != -1)
        {
            return query;
        }

        var querystring = []
        for(var i in this.activeSearch.filters)
        {
            var val = this.activeSearch.filters[i]
            if(val.name == defaultName && defaultValue != undefined)
            {
                val.value = defaultValue
                isAddedDefaultValue = true
            }

            querystring.push(val.name + "=" + encodeURIComponent(val.value))
        }

        if(!isAddedDefaultValue && defaultValue)
        {
            querystring.push(defaultName + "=" + encodeURIComponent(defaultValue))
        }

        return querystring.join(",");
    },
 
    /**
     * Преобразует строку поиска в объект с параметрами для фильтрации
     * @param {string} query строка запроса
     * @param {string} defaultName имя параметра по умолчанию
     * @param {boolean} includeVariables если передать true то переменные из Variables будут добавлены не в массив search['variables'] а в search
     * @returns {pmItems.searchStringToObject.search} объект для поиска
     */
    searchStringToObject : function(query, defaultName, includeVariables)
    { 
        var search = {}
        if(query == "")
        {
            return search;
        }

        if(query.indexOf("=") == -1)
        {
            if(!defaultName)
            {
                defaultName = 'name'
            }

            search[defaultName+"__contains"] = query;
        }
        else
        {
            var vars = query.split(",")
            for(var i in vars)
            {
                if(vars[i].indexOf("=") == -1)
                {
                    continue;
                }

                var arg = vars[i].split("=")

                if(!search[arg[0]] && !search[arg[0]+"__in"])
                {
                    if(this.activeSearch.fields[arg[0]] && this.activeSearch.fields[arg[0]].mode == "__contains")
                    {
                        search[arg[0]+"__contains"] = arg[1]
                    }
                    else
                    {
                        search[arg[0]] = arg[1]
                    }
                }
                else if(Array.isArray(search[arg[0]+"__in"])) // @fixme Можно попробовать удалить +"__in" тогда надо проверить поиск 
                {
                    search[arg[0]+"__in"].push(arg[1]) // @fixme Можно попробовать удалить +"__in" тогда надо проверить поиск 
                }
                else
                {
                    search[arg[0]+"__in"] = [search[arg[0]], arg[1]] // @fixme Можно попробовать удалить +"__in" тогда надо проверить поиск 
                    delete search[arg[0]]
                    delete search[arg[0]+"__contains"]
                }
            }
        }

        var variables = {}
        for(var i in search)
        {
            if(!this.activeSearch.fields[i]
                && !this.activeSearch.fields[i.replace("__in", "")]
                && !this.activeSearch.fields[i.replace("__contains", "")])
            {
                // Проверка того что мы получили возможно синоним одного из полей вместо имени и надо заменить синоним именем фильтра
                for(var j in this.activeSearch.fields)
                {
                    if(this.activeSearch.fields[j].alias)
                    {
                        for(var k in this.activeSearch.fields[j].alias)
                        {
                            if(this.activeSearch.fields[j].alias[k] == i)
                            {
                                // заменить синоним именем фильтра
                                search[this.activeSearch.fields[j].name] = search[i]
                                delete search[i]
                                continue;
                            }
                        }
                    }
                }

                // Переменная не встречается в списке допустимых фильтров
                //console.warn("Переменная `"+i+"` не встречается в списке допустимых фильтров", this.activeSearch.fields)
                //delete search[i]
                continue;
            }

            if(this.activeSearch.fields[i] && this.activeSearch.fields[i].variables)
            {
                // Переменная не фильтр а из variables для ansible
                variables[i] = search[i]
                delete search[i]
            }
        }

        if(Object.getOwnPropertyNames(variables).length)
        {
            if(includeVariables)
            {
                // Добавить variables в search
                for(var i in variables)
                {
                    search[i] = variables[i]
                }
            }
            else
            {
                // Добавить variables в search['variables']
                var variablesString = [];
                for(var i in variables)
                {
                    variablesString.push(i +":"+variables[i])
                }

                search['variables'] = variablesString//.join(",")
            }
        }

        return search;
    },


    megreVariablesToFields : function(variables)
    {
        for(var i in variables)
        {
            this.activeSearch.fields[i] = variables[i]
            this.activeSearch.fields[i].name = i
            this.activeSearch.fields[i].variables = true
        }
    },

////////////////////////////////////////////////
// pagination
////////////////////////////////////////////////

    paginationHtml : function ()
    {
        var list = this.model.data

        // http://testserver/api/v2/host/?limit=20&offset=40&ordering=desc
        var limit = guiLocalSettings.get('page_size');
        var offset = 0;

        if(this.model && this.model.data && this.model.data.previous)
        {
            limit = this.model.data.previous.match(/limit=([0-9]+)/)
            offset = this.model.data.previous.match(/offset=([0-9]+)/)
            if(limit && limit[1])
            {
                if(offset && offset[1])
                {
                    list.offset = offset[1]/1 + limit[1]/1
                }
                else
                {
                    list.offset = limit[1]/1
                }
            }
        }
        else if(this.model && this.model.data && this.model.data.next)
        {
            limit = this.model.data.next.match(/limit=([0-9]+)/)
            offset = 0
        }

        if(limit && limit[1])
        {
            limit = limit[1]/1
        }
        else
        {
            limit = guiLocalSettings.get('page_size')
        }

        var totalPage = list.count / limit
        if (totalPage > Math.floor(totalPage))
        {
            totalPage = Math.floor(totalPage) + 1
        }

        var currentPage = 0;
        if (list.offset)
        {
            currentPage = Math.floor(list.offset / limit)
        }
        var url = window.location.href

        return  spajs.just.render('pagination', {
            totalPage: totalPage,
            currentPage: currentPage,
            url: url})
    },

    getTotalPages : function ()
    {
        var limit = guiLocalSettings.get('page_size')

        if( this.model && this.model.data && this.model.data.previous )
        {
            var limitLink = this.model.data.previous.match(/limit=([0-9]+)/)
            if( limitLink && limitLink[1])
            {
                limit = limitLink[1]/1
            }
        }
        if( this.model && this.model.data && this.model.data.next )
        {
            var limitLink = this.model.data.next.match(/limit=([0-9]+)/)
            if( limitLink && limitLink[1])
            {
                limit = limitLink[1]/1
            }
        }

        return this.model.data.count / limit
    },

}

function createAndGoEdit(obj)
{
    var def = obj.create();
    $.when(def).done(function(newObj){

        vstGO(spajs.urlInfo.data.reg.baseURL(newObj.data.id));
    })

    return def;
}