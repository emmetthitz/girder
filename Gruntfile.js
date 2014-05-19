/**
 * Copyright 2013 Kitware Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = function (grunt) {
    var apiRoot;
    var staticRoot;
    var fs = require('fs');
    var path = require('path');
    require('colors');

    var defaultTasks = ['stylus', 'build-js'];

    // Project configuration.
    grunt.config.init({
        pkg: grunt.file.readJSON('package.json'),

        jade: {
            options: {
                client: true,
                compileDebug: false,
                namespace: 'jade.templates',
                processName: function (filename) {
                    return path.basename(filename, '.jade');
                }
            },
            core: {
                files: {
                    'clients/web/static/built/templates.js': [
                        'clients/web/src/templates/**/*.jade'
                    ]
                }
            }
        },

        copy: {
            swagger: {
                files: [{
                    expand: true,
                    cwd: 'node_modules/swagger-ui/dist',
                    src: ['lib/**', 'css/**', 'images/**', 'swagger-ui.min.js'],
                    dest: 'clients/web/static/built/swagger'
                }, {
                    expand: true,
                    cwd: 'node_modules/requirejs',
                    src: ['require.js'],
                    dest: 'clients/web/static/built/swagger/lib'
                }]
            }
        },

        stylus: {
            core: {
                files: {
                    'clients/web/static/built/app.min.css': [
                        'clients/web/src/stylesheets/**/*.styl',
                        '!clients/web/src/stylesheets/apidocs/*.styl'
                    ],
                    'clients/web/static/built/swagger/docs.css': [
                        'clients/web/src/stylesheets/apidocs/*.styl'
                    ]
                }
            }
        },

        shell: {
            sphinx: {
                command: [
                    'cd docs',
                    'make html'
                ].join('&&'),
                options: {
                    stdout: true
                }
            },
            readServerConfig: {
                command: 'python config_parse.py girder/conf/local.server.cfg',
                options: {
                    callback: setServerConfig
                }
            }
        },

        uglify: {
            options: {
                sourceMap: environment === 'dev',
                sourceMapIncludeSources: true,
                report: 'min'
            },
            app: {
                files: {
                    'clients/web/static/built/app.min.js': [
                        'clients/web/static/built/templates.js',
                        'clients/web/src/init.js',
                        'clients/web/src/app.js',
                        'clients/web/src/router.js',
                        'clients/web/src/utilities.js',
                        'clients/web/src/plugin_utils.js',
                        'clients/web/src/collection.js',
                        'clients/web/src/model.js',
                        'clients/web/src/view.js',
                        'clients/web/src/models/**/*.js',
                        'clients/web/src/collections/**/*.js',
                        'clients/web/src/views/**/*.js'
                    ],
                    'clients/web/static/built/main.min.js': [
                        'clients/web/src/main.js'
                    ]
                }
            },
            libs: {
                files: {
                    'clients/web/static/built/libs.min.js': [
                        'node_modules/jquery-browser/lib/jquery.js',
                        'node_modules/jade/runtime.js',
                        'node_modules/underscore/underscore.js',
                        'node_modules/backbone/backbone.js',
                        'clients/web/lib/js/bootstrap.min.js',
                        'clients/web/lib/js/bootstrap-switch.min.js',
                        'clients/web/lib/js/jquery.jqplot.min.js',
                        'clients/web/lib/js/jqplot.pieRenderer.min.js'
                    ]
                }
            }
        },

        watch: {
            stylus_core: {
                files: ['clients/web/src/stylesheets/**/*.styl'],
                tasks: ['stylus:core'],
                options: {failOnError: false}
            },
            js_core: {
                files: ['clients/web/src/**/*.js'],
                tasks: ['uglify:app'],
                options: {failOnError: false}
            },
            jade_core: {
                files: ['clients/web/src/templates/**/*.jade'],
                tasks: ['build-js'],
                options: {failOnError: false}
            },
            swagger: {
                files: ['clients/web/src/templates/swagger/swagger.jadehtml'],
                tasks: ['swagger-ui'],
                options: {failOnError: false}
            },
            sphinx: {
                files: ['docs/*.rst'],
                tasks: ['docs'],
                options: {failOnError: false}
            }
        }
    });

    var setServerConfig = function (err, stdout, stderr, callback) {
        if (err) {
            grunt.fail.fatal('config_parse failed on local.server.cfg: ' + stderr);
        }
        try {
            var cfg = JSON.parse(stdout);
            apiRoot = (cfg.server.api_root || '/api/v1').replace(/\"/g, "");
            staticRoot = (cfg.server.static_root || '/static').replace(/\"/g, "");
            console.log('Static root: ' + staticRoot.bold);
            console.log('API root: ' + apiRoot.bold);
        }
        catch (e) {
            grunt.fail.fatal('Invalid json from config_parse: ' + stdout);
        }
        callback();
    };

    // Pass a "--env=<value>" argument to grunt. Default value is "dev".
    var environment = grunt.option('env') || 'dev';

    if (['dev', 'prod'].indexOf(environment) === -1) {
        grunt.fatal('The "env" argument must be either "dev" or "prod".');
    }

    // Configure a given plugin for building
    var configurePlugin = function (pluginDir) {
        var pluginName = path.basename(pluginDir);
        var staticDir = 'clients/web/static/built/plugins/' + pluginName;

        console.log(('Found plugin: ' + pluginName).bold.underline);

        if (!fs.existsSync(staticDir)) {
            fs.mkdirSync(staticDir);
        }

        var jadeDir = pluginDir + '/web_client/templates';
        if (fs.existsSync(jadeDir)) {
            var files = {};
            files[staticDir + '/templates.js'] = [jadeDir + '/**/*.jade'];
            grunt.config.set('jade.plugin_' + pluginName, {
                files: files
            });
            grunt.config.set('watch.jade_' + pluginName, {
                files: [jadeDir + '/**/*.jade'],
                tasks: ['jade:plugin_' + pluginName, 'uglify:plugin_' + pluginName],
                options: {failOnError: false}
            });
        }

        var cssDir = pluginDir + '/web_client/stylesheets';
        if (fs.existsSync(cssDir)) {
            var files = {};
            files[staticDir + '/plugin.min.css'] = [cssDir + '/**/*.styl'];
            grunt.config.set('stylus.plugin_' + pluginName, {
                files: files
            });
            grunt.config.set('watch.stylus_' + pluginName, {
                files: [cssDir + '/**/*.styl'],
                tasks: ['stylus:plugin_' + pluginName],
                options: {failOnError: false}
            });
        }

        var jsDir = pluginDir + '/web_client/js';
        if (fs.existsSync(jsDir)) {
            var files = {};
            files[staticDir + '/plugin.min.js'] = [
                staticDir + '/templates.js',
                jsDir + '/**/*.js'
            ];
            grunt.config.set('uglify.plugin_' + pluginName, {
                files: files
            });
            grunt.config.set('watch.js_' + pluginName, {
                files: [jsDir + '/**/*.js'],
                tasks: ['uglify:plugin_' + pluginName],
                options: {failOnError: false}
            });
            defaultTasks.push('uglify:plugin_' + pluginName);
        }
    };

    // Glob for front-end plugins and configure each one to build
    var pluginDirs = grunt.file.expand('plugins/*');

    if (!fs.existsSync('clients/web/static/built/plugins')) {
        fs.mkdirSync('clients/web/static/built/plugins');
    }

    pluginDirs.forEach(function (pluginDir) {
        if (fs.existsSync(pluginDir + '/web_client')) {
            configurePlugin(pluginDir);
        }
    });

    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-jade');
    grunt.loadNpmTasks('grunt-contrib-stylus');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.registerTask('swagger-ui', 'Build swagger front-end requirements.', function () {
        var jade = require('jade');
        var buffer = fs.readFileSync('clients/web/src/templates/swagger/swagger.jadehtml');

        var fn = jade.compile(buffer, {
            client: false
        });
        fs.writeFileSync('clients/web/static/built/swagger/swagger.html', fn({
            staticRoot: staticRoot
        }));
    });

    // This task should be run once manually at install time.
    grunt.registerTask('setup', 'Initial install/setup tasks', function () {
        // Copy all configuration files that don't already exist
        var cfgDir = 'girder/conf';
        var configs = grunt.file.expand(cfgDir + '/*.cfg');
        configs.forEach(function (config) {
            var name = path.basename(config);
            if (name.substring(0, 5) === 'local') {
                return;
            }
            var local = cfgDir + '/local.' + name;
            if (!fs.existsSync(local)) {
                fs.writeFileSync(local, fs.readFileSync(config));
                console.log('Created config ' + local.magenta + '.');
            }
        });
    });

    grunt.registerTask('build-js', [
        'shell:readServerConfig',
        'jade',
        'uglify:app'
    ]);
    grunt.registerTask('init', [
        'setup',
        'uglify:libs',
        'copy:swagger',
        'shell:readServerConfig',
        'swagger-ui'
    ]);
    grunt.registerTask('docs', ['shell:sphinx']);
    grunt.registerTask('default', defaultTasks);
};
