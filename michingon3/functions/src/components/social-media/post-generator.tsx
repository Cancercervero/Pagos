'use client';

import React, { useState, useRef } from 'react';
import {
    SocialPlatform,
    PLATFORM_STYLES,
    getPlatformsArray,
    validatePostLength,
    extractHashtags
} from '@/types/social-media-types';
import { useBusinessType } from '@/contexts/BusinessTypeContext';
import { businessTypeToNiche } from '@/lib/prompts/niche-prompts';

// ═══════════════════════════════════════════════════════════════
// TIPOS LOCALES
// ═══════════════════════════════════════════════════════════════

interface GeneratedPost {
    text: string;
    hashtags: string[];
    imageUrl?: string;
    suggestions?: string[];
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function PostGenerator() {
    const { businessType } = useBusinessType();
    const niche = businessType ? businessTypeToNiche(businessType) : 'almacen';

    const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform>('instagram');
    const [productDescription, setProductDescription] = useState('');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const platforms = getPlatformsArray();
    const currentStyle = PLATFORM_STYLES[selectedPlatform];

    // ─────────────────────────────────────────────────────────────
    // HANDLERS
    // ─────────────────────────────────────────────────────────────

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!productDescription.trim()) return;

        setIsGenerating(true);

        try {
            // Llamar a la API de generación
            const response = await fetch('/api/social-media/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: selectedPlatform,
                    productDescription,
                    niche: niche || 'almacen',
                    imageBase64: uploadedImage
                })
            });

            if (response.ok) {
                const data = await response.json();
                setGeneratedPost(data);
            } else {
                // Fallback con texto de ejemplo si la API no está disponible
                setGeneratedPost({
                    text: generateFallbackPost(selectedPlatform, productDescription),
                    hashtags: ['michingon', 'negocio', 'promo'],
                    suggestions: ['API no disponible, se generó texto de ejemplo']
                });
            }
        } catch (error) {
            console.error('Error generating post:', error);
            // Fallback
            setGeneratedPost({
                text: generateFallbackPost(selectedPlatform, productDescription),
                hashtags: ['michingon', 'negocio'],
                suggestions: ['Error de conexión, se generó texto de ejemplo']
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyText = async () => {
        if (generatedPost?.text) {
            await navigator.clipboard.writeText(generatedPost.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownloadImage = () => {
        if (generatedPost?.imageUrl || uploadedImage) {
            const link = document.createElement('a');
            link.href = generatedPost?.imageUrl || uploadedImage || '';
            link.download = `post-${selectedPlatform}-${Date.now()}.png`;
            link.click();
        }
    };

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────

    return (
        <div className="post-generator">
            <div className="post-generator-header">
                <h2>📱 Crear Post para Redes Sociales</h2>
                <p>MAO te ayuda a crear contenido atractivo para tus redes</p>
            </div>

            {/* Selector de Plataforma */}
            <div className="platform-selector">
                <label>Selecciona plataforma:</label>
                <div className="platform-buttons">
                    {platforms.map(({ id, style }) => (
                        <button
                            key={id}
                            className={`platform-btn ${selectedPlatform === id ? 'active' : ''}`}
                            onClick={() => setSelectedPlatform(id)}
                            style={{
                                '--platform-color': style.color
                            } as React.CSSProperties}
                        >
                            <span className="platform-icon">{style.icon}</span>
                            <span className="platform-name">{id}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Subir Imagen */}
            <div className="image-upload-section">
                <label>📸 Imagen del producto (opcional):</label>
                <div
                    className="image-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                >
                    {uploadedImage ? (
                        <div className="uploaded-preview">
                            <img src={uploadedImage} alt="Producto" />
                            <button
                                className="remove-image"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setUploadedImage(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div className="dropzone-placeholder">
                            <span className="upload-icon">📷</span>
                            <p>Arrastra una imagen o haz clic para subir</p>
                        </div>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    hidden
                />
            </div>

            {/* Descripción del Producto */}
            <div className="description-section">
                <label>📝 Describe tu producto o servicio:</label>
                <textarea
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                    placeholder="Ej: Café latte con leche de almendras, nuevo en el menú, promoción 2x1 hoy"
                    rows={3}
                />
            </div>

            {/* Botón Generar */}
            <button
                className="generate-btn"
                onClick={handleGenerate}
                disabled={isGenerating || !productDescription.trim()}
            >
                {isGenerating ? (
                    <>
                        <span className="spinner"></span>
                        Generando...
                    </>
                ) : (
                    <>✨ Generar Post</>
                )}
            </button>

            {/* Resultado */}
            {generatedPost && (
                <div className="generated-result">
                    <h3>🎉 Tu post está listo!</h3>

                    <div className="result-content">
                        {/* Imagen */}
                        <div className="result-image">
                            {(generatedPost.imageUrl || uploadedImage) ? (
                                <img
                                    src={generatedPost.imageUrl || uploadedImage || ''}
                                    alt="Post"
                                />
                            ) : (
                                <div className="no-image">
                                    <span>📷</span>
                                    <p>Sin imagen</p>
                                </div>
                            )}
                        </div>

                        {/* Texto */}
                        <div className="result-text">
                            <div className="text-preview">
                                {generatedPost.text}
                            </div>

                            {/* Validación de longitud */}
                            {(() => {
                                const validation = validatePostLength(generatedPost.text, selectedPlatform);
                                return (
                                    <div className={`length-indicator ${validation.isValid ? 'valid' : 'invalid'}`}>
                                        {validation.currentLength} / {validation.maxLength} caracteres
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Hashtags */}
                    {generatedPost.hashtags.length > 0 && (
                        <div className="hashtags-preview">
                            {generatedPost.hashtags.map((tag, i) => (
                                <span key={i} className="hashtag">#{tag}</span>
                            ))}
                        </div>
                    )}

                    {/* Sugerencias */}
                    {generatedPost.suggestions && generatedPost.suggestions.length > 0 && (
                        <div className="suggestions">
                            <h4>💡 Sugerencias:</h4>
                            <ul>
                                {generatedPost.suggestions.map((s, i) => (
                                    <li key={i}>{s}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Acciones */}
                    <div className="result-actions">
                        <button
                            className="action-btn download"
                            onClick={handleDownloadImage}
                            disabled={!generatedPost.imageUrl && !uploadedImage}
                        >
                            ⬇️ Descargar Imagen
                        </button>
                        <button
                            className="action-btn copy"
                            onClick={handleCopyText}
                        >
                            {copied ? '✅ Copiado!' : '📋 Copiar Texto'}
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .post-generator {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 24px;
                    background: var(--card-bg, #1a1a2e);
                    border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                }

                .post-generator-header {
                    text-align: center;
                    margin-bottom: 24px;
                }

                .post-generator-header h2 {
                    font-size: 1.5rem;
                    margin-bottom: 8px;
                    color: var(--text-primary, #fff);
                }

                .post-generator-header p {
                    color: var(--text-secondary, #a0a0a0);
                    font-size: 0.9rem;
                }

                .platform-selector {
                    margin-bottom: 20px;
                }

                .platform-selector label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                    color: var(--text-primary, #fff);
                }

                .platform-buttons {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .platform-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 12px 16px;
                    border: 2px solid transparent;
                    border-radius: 12px;
                    background: var(--input-bg, #252542);
                    cursor: pointer;
                    transition: all 0.2s;
                    flex: 1;
                    min-width: 80px;
                }

                .platform-btn:hover {
                    border-color: var(--platform-color);
                    transform: translateY(-2px);
                }

                .platform-btn.active {
                    border-color: var(--platform-color);
                    background: color-mix(in srgb, var(--platform-color) 20%, transparent);
                }

                .platform-icon {
                    font-size: 1.5rem;
                    margin-bottom: 4px;
                }

                .platform-name {
                    font-size: 0.75rem;
                    text-transform: capitalize;
                    color: var(--text-secondary, #a0a0a0);
                }

                .image-upload-section {
                    margin-bottom: 20px;
                }

                .image-upload-section label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                    color: var(--text-primary, #fff);
                }

                .image-dropzone {
                    border: 2px dashed var(--border-color, #3a3a5c);
                    border-radius: 12px;
                    padding: 24px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: var(--input-bg, #252542);
                }

                .image-dropzone:hover {
                    border-color: var(--primary-color, #6366f1);
                    background: var(--input-bg-hover, #2a2a4e);
                }

                .dropzone-placeholder {
                    color: var(--text-secondary, #a0a0a0);
                }

                .upload-icon {
                    font-size: 2rem;
                    display: block;
                    margin-bottom: 8px;
                }

                .uploaded-preview {
                    position: relative;
                    display: inline-block;
                }

                .uploaded-preview img {
                    max-height: 200px;
                    max-width: 100%;
                    border-radius: 8px;
                }

                .remove-image {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    border: none;
                    background: #ff4444;
                    color: white;
                    cursor: pointer;
                    font-size: 12px;
                }

                .description-section {
                    margin-bottom: 20px;
                }

                .description-section label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                    color: var(--text-primary, #fff);
                }

                .description-section textarea {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid var(--border-color, #3a3a5c);
                    border-radius: 8px;
                    background: var(--input-bg, #252542);
                    color: var(--text-primary, #fff);
                    font-size: 0.95rem;
                    resize: vertical;
                }

                .description-section textarea:focus {
                    outline: none;
                    border-color: var(--primary-color, #6366f1);
                }

                .generate-btn {
                    width: 100%;
                    padding: 14px;
                    border: none;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    color: white;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .generate-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
                }

                .generate-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid transparent;
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .generated-result {
                    margin-top: 24px;
                    padding: 20px;
                    background: var(--result-bg, #1f1f3a);
                    border-radius: 12px;
                    border: 1px solid var(--border-color, #3a3a5c);
                }

                .generated-result h3 {
                    text-align: center;
                    margin-bottom: 16px;
                    color: var(--text-primary, #fff);
                }

                .result-content {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 16px;
                }

                @media (max-width: 500px) {
                    .result-content {
                        grid-template-columns: 1fr;
                    }
                }

                .result-image {
                    aspect-ratio: 1;
                    border-radius: 8px;
                    overflow: hidden;
                    background: var(--input-bg, #252542);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .result-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .no-image {
                    text-align: center;
                    color: var(--text-secondary, #a0a0a0);
                }

                .no-image span {
                    font-size: 2rem;
                    display: block;
                    margin-bottom: 8px;
                }

                .result-text {
                    display: flex;
                    flex-direction: column;
                }

                .text-preview {
                    flex: 1;
                    padding: 12px;
                    background: var(--input-bg, #252542);
                    border-radius: 8px;
                    font-size: 0.9rem;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    color: var(--text-primary, #fff);
                    max-height: 200px;
                    overflow-y: auto;
                }

                .length-indicator {
                    margin-top: 8px;
                    font-size: 0.75rem;
                    text-align: right;
                }

                .length-indicator.valid {
                    color: #22c55e;
                }

                .length-indicator.invalid {
                    color: #ef4444;
                }

                .hashtags-preview {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-bottom: 16px;
                }

                .hashtag {
                    padding: 4px 10px;
                    background: var(--primary-color-light, #4f46e5);
                    color: white;
                    border-radius: 16px;
                    font-size: 0.8rem;
                }

                .suggestions {
                    margin-bottom: 16px;
                    padding: 12px;
                    background: var(--input-bg, #252542);
                    border-radius: 8px;
                }

                .suggestions h4 {
                    margin-bottom: 8px;
                    font-size: 0.9rem;
                    color: var(--text-primary, #fff);
                }

                .suggestions ul {
                    margin: 0;
                    padding-left: 20px;
                    font-size: 0.85rem;
                    color: var(--text-secondary, #a0a0a0);
                }

                .result-actions {
                    display: flex;
                    gap: 12px;
                }

                .action-btn {
                    flex: 1;
                    padding: 12px;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-btn.download {
                    background: #3b82f6;
                    color: white;
                }

                .action-btn.copy {
                    background: #22c55e;
                    color: white;
                }

                .action-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                }

                .action-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Fallback post generator
// ═══════════════════════════════════════════════════════════════

function generateFallbackPost(platform: SocialPlatform, description: string): string {
    const style = PLATFORM_STYLES[platform];

    switch (platform) {
        case 'instagram':
            return `✨ ${description}\n\n¡No te lo pierdas! Visítanos hoy 🎉\n\n#NegocioLocal #Promo #Michingon`;
        case 'facebook':
            return `¡Hola amigos! 👋\n\nQueremos compartirles: ${description}\n\n¿Qué opinan? ¡Los esperamos!\n\n#Promo #NegocioLocal`;
        case 'tiktok':
            return `POV: ${description} 🔥 #FYP #ParaTi #Viral`;
        case 'whatsapp':
            return `Hola! 👋\n\n${description}\n\n¿Te gustaría más información?`;
        default:
            return description;
    }
}
