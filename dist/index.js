/* -.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.
* File Name   : promise.js
* Created at  : 2016-09-01
* Updated at  : 2017-08-31
* Author      : jeefo
* Purpose     :
* Description :
_._._._._._._._._._._._._._._._._._._._._.*/

var JeefoPromise = function (promise_handler, callback, args) {
	var state           = 0,
		pendings        = [],
		instance        = this,
		is_last_chain   = true,
		pendings_length = 0,
		result;

	instance.then        = then;
	instance.state       = "pending...";
	instance.result      = get_result;
	instance.$catch      = $catch;
	instance.$finally    = $finally;
	instance.is_pending  = is_pending;
	instance.is_rejected = is_rejected;
	instance.is_resolved = is_resolved;

	// Promise handler {{{1
	try {
		promise_handler(_resolver, _rejector);
	} catch (e) {
		_rejector(e);
	}
	// }}}1

	// jshint latedef : false
	return instance;

	// Is pending ? {{{1
	function is_pending () {
		return state === 0;
	}

	// Is rejected ? {{{1
	function is_rejected () {
		return state === 2;
	}

	// Is resolved ? {{{1
	function is_resolved () {
		return state === 1;
	}

	// Get result {{{1
	function get_result () {
		return result;
	}

	// Resolver {{{1
	function _resolver (value) {
		if (state !== 0) { return; }

		state          = 1;
		instance.state = "resolved";
		instance.value = result = value;

		for (var i = 0; i < pendings_length; i += 4) {
			try {
				value = pendings[i](result);

				if (value && value.then) {
					value.then(pendings[i + 2], pendings[i + 3]);
				} else {
					pendings[i + 2](value);
				}
			} catch (error) {
				pendings[i + 3](error);
			}
		}

		if (is_last_chain && callback) {
			callback.apply(null, args);
		}

		pendings        = null;
		pendings_length = 0;
	}

	// Rejector {{{1
	function _rejector (reason) {
		if (state !== 0) { return; }

		state           = 2;
		instance.state  = "rejected";
		instance.reason = result = reason;

		for (var i = 1; i < pendings_length; i += 4) {
			try {
				reason = pendings[i](reason);

				if (reason && reason.then) {
					reason.then(pendings[i + 1], pendings[i + 2]);
				} else {
					pendings[i + 2](reason);
				}
			} catch (error) {
				pendings[i + 2](error);
			}
		}

		if (is_last_chain && callback) {
			callback.apply(null, args);
		}

		pendings        = null;
		pendings_length = 0;
	}

	// Then {{{1
	function then (resolver, rejector) {
		is_last_chain = false;

		return new JeefoPromise(function (next_resolver, next_rejector) {
			switch (state) {
				case 1 :
					var next_result = resolver ? resolver(result) : result;
					return (next_result && next_result.then)
						? next_result.then(next_resolver, next_rejector)
						: next_resolver(next_result);
				case 2 :
					return rejector
						? next_resolver(rejector(result))
						: next_rejector(result);
				default:
					pendings[pendings_length]     = resolver || get_result;
					pendings[pendings_length + 1] = rejector || get_result;
					pendings[pendings_length + 2] = next_resolver;
					pendings[pendings_length + 3] = next_rejector;
					pendings_length += 4;
			}
		});
	}

	// Catch {{{1
	function $catch (rejector) {
		return then(null, rejector);
	}

	// Finally {{{1
	function $finally (callback) {
		return then(function (value) {
			callback(value);
			return value;
		}, function (reason) {
			callback(reason);
			throw reason;
		});
	}
	// }}}1
	// jshint latedef : true
};

module.exports = JeefoPromise;
