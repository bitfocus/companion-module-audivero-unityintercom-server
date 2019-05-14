// Audivero - Unity Intercom
var instance_skel = require('../../instance_skel');
var tcp = require('../../tcp');

var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions();

	return self;
}

instance.prototype.updateConfig = function(config) {
	var self = this;
	self.config = config;
	self.debug('updateConfig() destroying and reiniting..');
	self.destroy();
	self.init();
}

instance.prototype.init = function() {
	var self = this;

	self.status(self.STATUS_OK);
	
	self.channels = [];
	self.groups = [];
	self.users = [];
	self.feeds = [];
	
	self.userList = [];
	
	self.interval = setInterval(function() {
		self.system.emit('rest_get', 'http://' + self.config.host + ':' + self.config.port + '/userconfig',function (err, data, response) {
			if (err !== null) {
				self.status(self.status_ERROR, err);
				return;
			}
			else {		
				self.status(self.STATUS_OK);
				
				let unitydata = data.data;

				self.channels = unitydata.channels;
				self.groups = unitydata.groups;
				self.users = unitydata.users;
				self.feeds = unitydata.feeds;
				
				self.userList = [];

				var users_total_loggedin = 0;

				for (var u in self.users) {
					let user = self.users[u];
					self.userList.push({ id: user.username, label: user.title + ' (' + user.username + ')' });
					if (user.online === "1") {
						users_total_loggedin++;
					}
				}

				self.actions();
				self.init_presets();
				self.init_feedbacks();
				self.init_variables();

				self.setVariable('users_total_loggedin', users_total_loggedin);

				self.checkFeedbacks('user_loggedin');
				self.checkFeedbacks('user_loggedout');
			}
		});
	}, self.config.refresh);
}

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Unity Intercom Server',
			width: 8
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Unity Intercom Server Port',
			width: 4,
			default: 20101,
			regex: self.REGEX_PORT
		},
		{
			type: 'textinput',
			id: 'refresh',
			label: 'Data Refresh Rate (In Milliseconds)',
			width: 4,
			tooltip: 'How often new data should be retrieved from the Unity Server.',
			default: 10000,
			regex: self.REGEX_NUMBER
		}
	]
}

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	
	clearInterval(self.interval);
	
	self.channels = [];
	self.groups = [];
	self.users = [];
	self.feeds = [];
	
	self.userList = [];
	
	self.debug('destroy');
}

instance.prototype.actions = function() {
	var self = this;
	
	self.system.emit('instance_actions', self.id, {
		//future actions can be added here
	});
}

instance.prototype.action = function(action) {
	var self = this;

	switch(action.action) {
		//future actions can be processed here
	}
}

instance.prototype.init_feedbacks = function() {
	var self = this;

	// feedbacks
	var feedbacks = {};

	feedbacks['user_loggedin'] = {
		label: 'User is Logged In',
		description: 'If the user is logged in, change colors of the bank',
		options: [
			{
				type: 'dropdown',
				label: 'User',
				id: 'user',
				choices: self.userList
			},
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255,255,255)
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(0,255,0)
			},
		]
	};
	
	feedbacks['user_loggedout'] = {
		label: 'User is Logged Out',
		description: 'If the user is logged out, change colors of the bank',
		options: [
			{
				type: 'dropdown',
				label: 'User',
				id: 'user',
				choices: self.userList
			},
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255,255,255)
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(255,0,0)
			},
		]
	};

	self.setFeedbackDefinitions(feedbacks);
}

instance.prototype.feedback = function(feedback, bank) {
	var self = this;
	
	if (feedback.type == 'user_loggedin') {
		if (self.users !== undefined) {
			var userObj = self.users.find(u => u.username === feedback.options.user);
			if (userObj) {
				if (userObj.online === "1") {
					return { color: feedback.options.fg, bgcolor: feedback.options.bg };
				}
			}
		}
	}
	
	if (feedback.type == 'user_loggedout') {
		if (self.users !== undefined) {
			var userObj = self.users.find(u => u.username === feedback.options.user);
			if (userObj) {
				if (userObj.online === "0") {
					return { color: feedback.options.fg, bgcolor: feedback.options.bg };
				}
			}
		}
	}

	return {};
}

instance.prototype.init_presets = function () {
	var self = this;
	var presets = [];

	for (var u in self.users) {
		let user = self.users[u];

		presets.push({
			category: 'Users',
			label: 'User Logged In/Out: ' + user.title,
			bank: {
				style: 'text',
				text: ((user.title === '') ? user.username : user.title),
				size: 'auto',
				color: self.rgb(255,255,255),
				bgcolor: 0
			},
			feedbacks: [
				{
					type: 'user_loggedin',
					options: {
						bg: self.rgb(0,255,0),
						fg: self.rgb(255,255,255),
						user: user.username
					}
				},
				{
					type: 'user_loggedout',
					options: {
						bg: self.rgb(255,0,0),
						fg: self.rgb(255,255,255),
						user: user.username
					}
				}
			],
			actions: [
			]
		});
	}

	// Preset for Total Users Logged In
	presets.push({
		category: 'Users',
		label: 'Total Users Logged In',
		bank: {
			style: 'text',
			text: '$(' + self.package_info.name + ':users_total_loggedin)',
			size: 'auto',
			color: self.rgb(255,255,255),
			bgcolor: 0
		},
		feedbacks: [
		],
		actions: [
		]
	});

	self.setPresetDefinitions(presets);
}

instance.prototype.init_variables = function() {
	var self = this;

	var variables = [];

	variables.push({ name: 'users_total_loggedin', label: 'Total Users Logged In' });

	self.setVariableDefinitions(variables);
}

instance_skel.extendedBy(instance);
exports = module.exports = instance;
