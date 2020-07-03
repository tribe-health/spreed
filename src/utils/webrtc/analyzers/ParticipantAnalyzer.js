/**
 *
 * @copyright Copyright (c) 2020, Daniel Calviño Sánchez (danxuliu@gmail.com)
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

import {
	PEER_DIRECTION,
	PeerConnectionAnalyzer,
} from './PeerConnectionAnalyzer'

/**
 * Analyzer for the quality of the connections of a Participant.
 *
 * After a ParticipantAnalyzer is created the participant to analyze must be set
 * using any of the "setXXXParticipant" methods; "setSenderReceiverParticipant"
 * is meant to be used when there is no HPB, while "setSenderParticipant" and
 * "setReceiverParticipant" are meant to be used when there is an HPB for the
 * local and remote participants respectively.
 *
 * When the quality of the connections change different events will be triggered
 * depending on the case:
 * - 'change:senderConnectionQualityAudio'
 * - 'change:senderConnectionQualityVideo'
 * - 'change:senderConnectionQualityScreen'
 * - 'change:receiverConnectionQualityAudio'
 * - 'change:receiverConnectionQualityVideo'
 * - 'change:receiverConnectionQualityScreen'
 *
 * The reported values are based on CONNECTION_QUALITY values of
 * PeerConnectionAnalyzer.
 *
 * Note that the connections will be analyzed only when the corresponding media
 * is enabled so, for example, if a sender participant has muted but still has
 * the video enabled only the video quality will be analyzed until the audio is
 * unmuted again. This is done not only because the connection quality of media
 * is less relevant when the media is disabled, but also because the connection
 * stats provided by the browser and used for the analysis are less reliable in
 * that case.
 *
 * Once the ParticipantAnalyzer is no longer needed "destroy()" must be called
 * to stop the analysis.
 */
function ParticipantAnalyzer() {
	this._handlers = []

	this._localMediaModel = null
	this._localCallParticipantModel = null
	this._callParticipantModel = null

	this._peer = null
	this._screenPeer = null

	this._senderPeerConnectionAnalyzer = null
	this._receiverPeerConnectionAnalyzer = null
	this._senderScreenPeerConnectionAnalyzer = null
	this._receiverScreenPeerConnectionAnalyzer = null

	this._handlePeerChangeBound = this._handlePeerChange.bind(this)
	this._handleScreenPeerChangeBound = this._handleScreenPeerChange.bind(this)
	this._handleSenderAudioEnabledChangeBound = this._handleSenderAudioEnabledChange.bind(this)
	this._handleSenderVideoEnabledChangeBound = this._handleSenderVideoEnabledChange.bind(this)
	this._handleReceiverAudioAvailableChangeBound = this._handleReceiverAudioAvailableChange.bind(this)
	this._handleReceiverVideoAvailableChangeBound = this._handleReceiverVideoAvailableChange.bind(this)
	this._handleConnectionQualityAudioChangeBound = this._handleConnectionQualityAudioChange.bind(this)
	this._handleConnectionQualityVideoChangeBound = this._handleConnectionQualityVideoChange.bind(this)
	this._handleConnectionQualityScreenChangeBound = this._handleConnectionQualityScreenChange.bind(this)
}
ParticipantAnalyzer.prototype = {

	on: function(event, handler) {
		if (!this._handlers.hasOwnProperty(event)) {
			this._handlers[event] = [handler]
		} else {
			this._handlers[event].push(handler)
		}
	},

	off: function(event, handler) {
		const handlers = this._handlers[event]
		if (!handlers) {
			return
		}

		const index = handlers.indexOf(handler)
		if (index !== -1) {
			handlers.splice(index, 1)
		}
	},

	_trigger: function(event, args) {
		let handlers = this._handlers[event]
		if (!handlers) {
			return
		}

		args.unshift(this)

		handlers = handlers.slice(0)
		for (let i = 0; i < handlers.length; i++) {
			const handler = handlers[i]
			handler.apply(handler, args)
		}
	},

	destroy: function() {
		if (this._localCallParticipantModel) {
			this._localCallParticipantModel.off('change:peer', this._handlePeerChangeBound)
		}

		if (this._callParticipantModel) {
			this._callParticipantModel.off('change:peer', this._handlePeerChangeBound)
		}

		this._stopListeningToAudioVideoChanges()
		this._stopListeningToScreenChanges()

		this._localMediaModel = null
		this._localCallParticipantModel = null
		this._callParticipantModel = null

		this._peer = null
		this._screenPeer = null

		this._senderPeerConnectionAnalyzer = null
		this._receiverPeerConnectionAnalyzer = null
		this._senderScreenPeerConnectionAnalyzer = null
		this._receiverScreenPeerConnectionAnalyzer = null
	},

	setSenderParticipant: function(localMediaModel, localCallParticipantModel) {
		this.destroy()

		this._localMediaModel = localMediaModel
		this._localCallParticipantModel = localCallParticipantModel

		if (this._localCallParticipantModel) {
			this._senderPeerConnectionAnalyzer = new PeerConnectionAnalyzer()
			this._senderScreenPeerConnectionAnalyzer = new PeerConnectionAnalyzer()

			this._localCallParticipantModel.on('change:peer', this._handlePeerChangeBound)
			this._handlePeerChange(this._localCallParticipantModel, this._localCallParticipantModel.get('peer'))

			this._localCallParticipantModel.on('change:screenPeer', this._handleScreenPeerChangeBound)
			this._handleScreenPeerChange(this._localCallParticipantModel, this._localCallParticipantModel.get('screenPeer'))
		}
	},

	setReceiverParticipant: function(callParticipantModel) {
		this.destroy()

		this._callParticipantModel = callParticipantModel

		if (this._callParticipantModel) {
			this._receiverPeerConnectionAnalyzer = new PeerConnectionAnalyzer()
			this._receiverScreenPeerConnectionAnalyzer = new PeerConnectionAnalyzer()

			this._callParticipantModel.on('change:peer', this._handlePeerChangeBound)
			this._handlePeerChange(this._callParticipantModel, this._callParticipantModel.get('peer'))

			this._callParticipantModel.on('change:screenPeer', this._handleScreenPeerChangeBound)
			this._handleScreenPeerChange(this._callParticipantModel, this._callParticipantModel.get('screenPeer'))
		}
	},

	setSenderReceiverParticipant: function(localMediaModel, callParticipantModel) {
		this.destroy()

		this._localMediaModel = localMediaModel
		this._callParticipantModel = callParticipantModel

		if (this._callParticipantModel) {
			this._senderPeerConnectionAnalyzer = new PeerConnectionAnalyzer()
			this._receiverPeerConnectionAnalyzer = new PeerConnectionAnalyzer()
			this._senderScreenPeerConnectionAnalyzer = new PeerConnectionAnalyzer()
			this._receiverScreenPeerConnectionAnalyzer = new PeerConnectionAnalyzer()

			this._callParticipantModel.on('change:peer', this._handlePeerChangeBound)
			this._handlePeerChange(this._callParticipantModel, this._callParticipantModel.get('peer'))

			this._callParticipantModel.on('change:screenPeer', this._handleScreenPeerChangeBound)
			this._handleScreenPeerChange(this._callParticipantModel, this._callParticipantModel.get('screenPeer'))
		}
	},

	_handlePeerChange: function(model, peer) {
		this._peer = peer

		if (peer) {
			this._startListeningToAudioVideoChanges()
		} else {
			this._stopListeningToAudioVideoChanges()
		}
	},

	_handleScreenPeerChange: function(model, screenPeer) {
		this._screenPeer = screenPeer

		if (screenPeer) {
			this._startListeningToScreenChanges()
		} else {
			this._stopListeningToScreenChanges()
		}
	},

	_startListeningToAudioVideoChanges: function() {
		if (this._localMediaModel) {
			this._senderPeerConnectionAnalyzer.setPeerConnection(this._peer.pc, PEER_DIRECTION.SENDER)

			this._senderPeerConnectionAnalyzer.on('change:connectionQualityAudio', this._handleConnectionQualityAudioChangeBound)
			this._senderPeerConnectionAnalyzer.on('change:connectionQualityVideo', this._handleConnectionQualityVideoChangeBound)

			this._localMediaModel.on('change:audioEnabled', this._handleSenderAudioEnabledChangeBound)
			this._localMediaModel.on('change:videoEnabled', this._handleSenderVideoEnabledChangeBound)

			this._handleSenderAudioEnabledChange(this._localMediaModel, this._localMediaModel.get('audioEnabled'))
			this._handleSenderVideoEnabledChange(this._localMediaModel, this._localMediaModel.get('videoEnabled'))
		}

		if (this._callParticipantModel) {
			this._receiverPeerConnectionAnalyzer.setPeerConnection(this._peer.pc, PEER_DIRECTION.RECEIVER)

			this._receiverPeerConnectionAnalyzer.on('change:connectionQualityAudio', this._handleConnectionQualityAudioChangeBound)
			this._receiverPeerConnectionAnalyzer.on('change:connectionQualityVideo', this._handleConnectionQualityVideoChangeBound)

			this._callParticipantModel.on('change:audioAvailable', this._handleReceiverAudioAvailableChangeBound)
			this._callParticipantModel.on('change:videoAvailable', this._handleReceiverVideoAvailableChangeBound)

			this._handleReceiverAudioAvailableChange(this._localMediaModel, this._callParticipantModel.get('audioAvailable'))
			this._handleReceiverVideoAvailableChange(this._localMediaModel, this._callParticipantModel.get('videoAvailable'))
		}
	},

	_startListeningToScreenChanges: function() {
		if (this._localMediaModel) {
			this._senderScreenPeerConnectionAnalyzer.setPeerConnection(this._screenPeer.pc, PEER_DIRECTION.SENDER)

			this._senderScreenPeerConnectionAnalyzer.on('change:connectionQualityVideo', this._handleConnectionQualityScreenChangeBound)
		}

		if (this._callParticipantModel) {
			this._receiverScreenPeerConnectionAnalyzer.setPeerConnection(this._screenPeer.pc, PEER_DIRECTION.RECEIVER)

			this._receiverScreenPeerConnectionAnalyzer.on('change:connectionQualityVideo', this._handleConnectionQualityScreenChangeBound)
		}
	},

	_stopListeningToAudioVideoChanges: function() {
		if (this._localMediaModel) {
			this._senderPeerConnectionAnalyzer.setPeerConnection(null)

			this._senderPeerConnectionAnalyzer.off('change:connectionQualityAudio', this._handleConnectionQualityAudioChangeBound)
			this._senderPeerConnectionAnalyzer.off('change:connectionQualityVideo', this._handleConnectionQualityVideoChangeBound)

			this._localMediaModel.off('change:audioEnabled', this._handleSenderAudioEnabledChangeBound)
			this._localMediaModel.off('change:videoEnabled', this._handleSenderVideoEnabledChangeBound)
		}

		if (this._callParticipantModel) {
			this._receiverPeerConnectionAnalyzer.setPeerConnection(null)

			this._receiverPeerConnectionAnalyzer.off('change:connectionQualityAudio', this._handleConnectionQualityAudioChangeBound)
			this._receiverPeerConnectionAnalyzer.off('change:connectionQualityVideo', this._handleConnectionQualityVideoChangeBound)

			this._callParticipantModel.off('change:audioAvailable', this._handleReceiverAudioAvailableChangeBound)
			this._callParticipantModel.off('change:videoAvailable', this._handleReceiverVideoAvailableChangeBound)
		}
	},

	_stopListeningToScreenChanges: function() {
		if (this._localMediaModel) {
			this._senderScreenPeerConnectionAnalyzer.setPeerConnection(null)

			this._senderPeerConnectionAnalyzer.off('change:connectionQualityVideo', this._handleConnectionQualityScreenChangeBound)
		}

		if (this._callParticipantModel) {
			this._receiverScreenPeerConnectionAnalyzer.setPeerConnection(null)

			this._receiverPeerConnectionAnalyzer.off('change:connectionQualityVideo', this._handleConnectionQualityScreenChangeBound)
		}
	},

	_handleConnectionQualityAudioChange: function(peerConnectionAnalyzer, connectionQualityAudio) {
		if (peerConnectionAnalyzer === this._senderPeerConnectionAnalyzer) {
			this._trigger('change:senderConnectionQualityAudio', [connectionQualityAudio])
		} else if (peerConnectionAnalyzer === this._receiverPeerConnectionAnalyzer) {
			this._trigger('change:receiverConnectionQualityAudio', [connectionQualityAudio])
		}
	},

	_handleConnectionQualityVideoChange: function(peerConnectionAnalyzer, connectionQualityVideo) {
		if (peerConnectionAnalyzer === this._senderPeerConnectionAnalyzer) {
			this._trigger('change:senderConnectionQualityVideo', [connectionQualityVideo])
		} else if (peerConnectionAnalyzer === this._receiverPeerConnectionAnalyzer) {
			this._trigger('change:receiverConnectionQualityVideo', [connectionQualityVideo])
		}
	},

	_handleConnectionQualityScreenChange: function(peerConnectionAnalyzer, connectionQualityScreen) {
		if (peerConnectionAnalyzer === this._senderScreenPeerConnectionAnalyzer) {
			this._trigger('change:senderConnectionQualityScreen', [connectionQualityScreen])
		} else if (peerConnectionAnalyzer === this._receiverScreenPeerConnectionAnalyzer) {
			this._trigger('change:receiverConnectionQualityScreen', [connectionQualityScreen])
		}
	},

	_handleSenderAudioEnabledChange: function(localMediaModel, audioEnabled) {
		this._senderPeerConnectionAnalyzer.setAnalysisEnabledAudio(audioEnabled)
	},

	_handleSenderVideoEnabledChange: function(localMediaModel, videoEnabled) {
		this._senderPeerConnectionAnalyzer.setAnalysisEnabledVideo(videoEnabled)
	},

	_handleReceiverAudioAvailableChange: function(callParticipantModel, audioAvailable) {
		this._receiverPeerConnectionAnalyzer.setAnalysisEnabledAudio(audioAvailable)
	},

	_handleReceiverVideoAvailableChange: function(callParticipantModel, videoAvailable) {
		this._receiverPeerConnectionAnalyzer.setAnalysisEnabledVideo(videoAvailable)
	},

}

export {
	ParticipantAnalyzer,
}
