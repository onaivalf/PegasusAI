/*---------------------------------------------------------------------------------------------
 *  PegasusAI - Extension Manager Pane (React)
 *  Copyright (c) PegasusAI Project. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import React, { useState, useEffect, useCallback } from 'react';
import { IVscodeExtensionHostService, ExtensionInfo, ExtensionMarketplaceEntry } from './vscodeExtensionHostService';

interface ExtensionManagerPaneProps {
	extensionService: IVscodeExtensionHostService;
}

type TabType = 'installed' | 'marketplace' | 'updates';

export const ExtensionManagerPane: React.FC<ExtensionManagerPaneProps> = ({ extensionService }) => {
	const [activeTab, setActiveTab] = useState<TabType>('installed');
	const [installedExtensions, setInstalledExtensions] = useState<ExtensionInfo[]>([]);
	const [marketplaceExtensions, setMarketplaceExtensions] = useState<ExtensionMarketplaceEntry[]>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Carregar extensões instaladas
	useEffect(() => {
		loadInstalledExtensions();
	}, []);

	const loadInstalledExtensions = async () => {
		setIsLoading(true);
		try {
			const extensions = await extensionService.getInstalledExtensions();
			setInstalledExtensions(extensions);
			setError(null);
		} catch (err) {
			setError(`Failed to load installed extensions: ${err}`);
		} finally {
			setIsLoading(false);
		}
	};

	// Carregar marketplace quando a aba for ativada
	useEffect(() => {
		if (activeTab === 'marketplace') {
			loadMarketplaceExtensions();
		}
	}, [activeTab]);

	const loadMarketplaceExtensions = async () => {
		setIsLoading(true);
		try {
			const extensions = await extensionService.searchMarketplace(searchQuery || '');
			setMarketplaceExtensions(extensions);
			setError(null);
		} catch (err) {
			setError(`Failed to load marketplace: ${err}`);
		} finally {
			setIsLoading(false);
		}
	};

	// Buscar no marketplace
	const handleSearch = useCallback(() => {
		if (activeTab === 'marketplace') {
			loadMarketplaceExtensions();
		}
	}, [searchQuery, activeTab]);

	// Instalar extensão
	const handleInstall = async (extensionId: string) => {
		try {
			await extensionService.installExtension(extensionId);
			alert(`Extension ${extensionId} installed successfully!`);
			loadInstalledExtensions();
		} catch (err) {
			alert(`Failed to install: ${err}`);
		}
	};

	// Desinstalar extensão
	const handleUninstall = async (extensionId: string) => {
		if (!confirm(`Are you sure you want to uninstall ${extensionId}?`)) return;
		
		try {
			await extensionService.uninstallExtension(extensionId);
			alert(`Extension ${extensionId} uninstalled.`);
			loadInstalledExtensions();
		} catch (err) {
			alert(`Failed to uninstall: ${err}`);
		}
	};

	// Habilitar/Desabilitar
	const handleToggleEnable = async (extensionId: string, currentlyEnabled: boolean) => {
		try {
			if (currentlyEnabled) {
				await extensionService.disableExtension(extensionId);
			} else {
				await extensionService.enableExtension(extensionId);
			}
			loadInstalledExtensions();
		} catch (err) {
			alert(`Failed to toggle: ${err}`);
		}
	};

	return (
		<div className="pegasusai-extension-manager">
			{/* Header com Tabs */}
			<div className="extension-header">
				<h2>PegasusAI Extensions</h2>
				<div className="tabs">
					<button 
						className={activeTab === 'installed' ? 'active' : ''} 
						onClick={() => setActiveTab('installed')}
					>
						Installed ({installedExtensions.length})
					</button>
					<button 
						className={activeTab === 'marketplace' ? 'active' : ''} 
						onClick={() => setActiveTab('marketplace')}
					>
						Marketplace
					</button>
					<button 
						className={activeTab === 'updates' ? 'active' : ''} 
						onClick={() => setActiveTab('updates')}
						disabled
						title="Coming soon"
					>
						Updates
					</button>
				</div>
				
				{activeTab === 'marketplace' && (
					<div className="search-bar">
						<input
							type="text"
							placeholder="Search extensions..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
						/>
						<button onClick={handleSearch}>Search</button>
					</div>
				)}
			</div>

			{/* Conteúdo */}
			<div className="extension-content">
				{isLoading && <div className="loading">Loading...</div>}
				
				{error && <div className="error-message">{error}</div>}

				{activeTab === 'installed' && (
					<div className="extensions-list">
						{installedExtensions.length === 0 ? (
							<p>No extensions installed yet.</p>
						) : (
							installedExtensions.map(ext => (
								<div key={ext.id} className="extension-item">
									<div className="extension-info">
										<h4>{ext.displayName || ext.id}</h4>
										<p className="description">{ext.description}</p>
										<p className="meta">
											v{ext.version} | {ext.publisher} | 
											<span className={`status ${ext.enabled ? 'enabled' : 'disabled'}`}>
												{ext.enabled ? 'Enabled' : 'Disabled'}
											</span>
										</p>
									</div>
									<div className="extension-actions">
										<button onClick={() => handleToggleEnable(ext.id, ext.enabled)}>
											{ext.enabled ? 'Disable' : 'Enable'}
										</button>
										<button onClick={() => handleUninstall(ext.id)} className="danger">
											Uninstall
										</button>
									</div>
								</div>
							))
						)}
					</div>
				)}

				{activeTab === 'marketplace' && (
					<div className="extensions-list">
						{marketplaceExtensions.length === 0 ? (
							<p>No extensions found. Try searching.</p>
						) : (
							marketplaceExtensions.map(ext => (
								<div key={ext.id} className="extension-item">
									<div className="extension-info">
										<h4>{ext.displayName}</h4>
										<p className="description">{ext.description}</p>
										<p className="meta">
											by {ext.publisher} | ⭐ {ext.rating} ({ext.downloadCount} downloads)
										</p>
									</div>
									<div className="extension-actions">
										<button onClick={() => handleInstall(ext.id)}>
											Install
										</button>
									</div>
								</div>
							))
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default ExtensionManagerPane;
