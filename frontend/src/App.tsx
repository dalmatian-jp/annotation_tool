import React, { useState, useEffect } from 'react';
import './App.css';
import Papa from 'papaparse';

const API_URL = 'http://localhost:8000';

function App() {
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'csv'
  const [list1, setList1] = useState('');
  const [list2, setList2] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [column1, setColumn1] = useState('');
  const [column2, setColumn2] = useState('');
  const [annotationColumn, setAnnotationColumn] = useState(''); // New state for annotation column
  const [annotationLabels, setAnnotationLabels] = useState('True,False');
  const [newLabel, setNewLabel] = useState('');

  const [pairs, setPairs] = useState<string[][]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<(string | null)[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setCsvHeaders(results.meta.fields || []);
          if (results.meta.fields) {
            setColumn1(results.meta.fields[0] || '');
            setColumn2(results.meta.fields[1] || '');
            setAnnotationColumn(results.meta.fields[2] || ''); // Set default for annotation column
          }
        },
      });
    }
  };

  const handleStartComparison = async () => {
    setError(null);
    if (inputMode === 'text') {
      try {
        const response = await fetch(`${API_URL}/api/lists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ list1, list2 }),
        });
        if (!response.ok) {
          throw new Error('リストの送信に失敗しました。');
        }
      } catch (err: any) {
        setError(err.message);
        return;
      }
    } else if (inputMode === 'csv' && csvFile) {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('column1', column1);
      formData.append('column2', column2);
      if (annotationColumn) {
        formData.append('annotation_column', annotationColumn);
      }

      try {
        const response = await fetch(`${API_URL}/api/upload_csv`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          throw new Error('CSVのアップロードに失敗しました。');
        }
      } catch (err: any) {
        setError(err.message);
        return;
      }
    }

    await fetchPairs();
    setIsComparing(true);
  };

  const fetchPairs = async () => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/pairs`);
      if (!response.ok) {
        throw new Error('ペアの取得に失敗しました。');
      }
      const data = await response.json();
      setPairs(data.pairs);
      
      // バックエンドから受け取ったresultsをそのまま使用し、空文字列やnullを未判定として扱う
      const processedResults = data.results.map((result: string | null) => 
        (result === null || result === '') ? null : String(result)
      );
      setResults(processedResults);

      // Find the first unjudged pair
      const firstUnjudgedIndex = processedResults.findIndex((result: string | null) => result === null);
      setCurrentIndex(firstUnjudgedIndex !== -1 ? firstUnjudgedIndex : data.pairs.length > 0 ? data.pairs.length - 1 : 0);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleJudgment = async (judgment: string) => {
    setError(null);
    const newResults = [...results];
    newResults[currentIndex] = judgment;
    setResults(newResults);

    try {
      const response = await fetch(`${API_URL}/api/judgment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: currentIndex, judgment }),
      });
      if (!response.ok) {
        throw new Error('判定の保存に失敗しました。');
      }
      handleNext();
    } catch (err: any) {
      setError(err.message);
      // Rollback on error
      newResults[currentIndex] = results[currentIndex];
      setResults(newResults);
    }
  };

  const handleNext = () => {
    if (currentIndex < pairs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleReset = async () => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/reset`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('リセットに失敗しました。');
      }
      setIsComparing(false);
      setList1('');
      setList2('');
      setCsvFile(null);
      setCsvHeaders([]);
      setColumn1('');
      setColumn2('');
      setPairs([]);
      setResults([]);
      setCurrentIndex(0);
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  const fetchResults = async () => {
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/results`);
      if (!response.ok) {
        throw new Error('結果の取得に失敗しました。');
      }
      const data = await response.json();
      setPairs(data.pairs);
      
      // バックエンドから受け取ったresultsをそのまま使用し、空文字列やnullを未判定として扱う
      const processedResults = data.results.map((result: string | null) => 
        (result === null || result === '') ? null : String(result)
      );
      setResults(processedResults);

      // Find the first unjudged pair
      const firstUnjudgedIndex = processedResults.findIndex((result: string | null) => result === null);
      setCurrentIndex(firstUnjudgedIndex !== -1 ? firstUnjudgedIndex : data.pairs.length > 0 ? data.pairs.length - 1 : 0);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDownload = () => {
    window.open(`${API_URL}/api/results/download`);
  };

  const handleAddNewLabel = () => {
    if (newLabel && !annotationLabels.split(',').includes(newLabel)) {
      setAnnotationLabels(annotationLabels + ',' + newLabel);
      setNewLabel('');
    }
  };
  
  useEffect(() => {
    if (isComparing) {
      fetchResults();
    }
  }, [isComparing]);

  const labels = annotationLabels.split(',').map(label => label.trim()).filter(label => label);
  const progress = pairs.length > 0 ? ((results.filter(r => r !== null).length) / pairs.length) * 100 : 0;

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <a className="navbar-brand" href="#">意味的類似性判定ツール</a>
        </div>
      </nav>

      <div className="container mt-4">
        {error && <div className="alert alert-danger">{error}</div>}

        {!isComparing ? (
          <div className="card">
            <div className="card-body">
              <div className="mb-3">
                <label htmlFor="annotationLabels" className="form-label">アノテーションラベル (カンマ区切り)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  id="annotationLabels" 
                  value={annotationLabels} 
                  onChange={(e) => setAnnotationLabels(e.target.value)} 
                />
              </div>

              <ul className="nav nav-tabs">
                <li className="nav-item">
                  <button className={`nav-link ${inputMode === 'text' ? 'active' : ''}`} onClick={() => setInputMode('text')}>
                    テキスト入力
                  </button>
                </li>
                <li className="nav-item">
                  <button className={`nav-link ${inputMode === 'csv' ? 'active' : ''}`} onClick={() => setInputMode('csv')}>
                    CSVアップロード
                  </button>
                </li>
              </ul>

              <div className="tab-content p-3 border border-top-0">
                {inputMode === 'text' ? (
                  <div>
                    <div className="row">
                      <div className="col-md-6">
                        <h5>リスト1</h5>
                        <textarea
                          className="form-control"
                          rows={10}
                          value={list1}
                          onChange={(e) => setList1(e.target.value)}
                          placeholder="単語やフレーズを改行区切りで入力"
                        />
                      </div>
                      <div className="col-md-6">
                        <h5>リスト2</h5>
                        <textarea
                          className="form-control"
                          rows={10}
                          value={list2}
                          onChange={(e) => setList2(e.target.value)}
                          placeholder="単語やフレーズを改行区切りで入力"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      <label htmlFor="csvFile" className="form-label">CSVファイル</label>
                      <input className="form-control" type="file" id="csvFile" accept=".csv" onChange={handleFileChange} />
                    </div>
                    {csvHeaders.length > 0 && (
                      <div className="row">
                        <div className="col-md-6">
                          <label htmlFor="column1" className="form-label">比較するカラム1</label>
                          <select id="column1" className="form-select" value={column1} onChange={(e) => setColumn1(e.target.value)}>
                            {csvHeaders.map(header => <option key={header} value={header}>{header}</option>)}
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label htmlFor="column2" className="form-label">比較するカラム2</label>
                          <select id="column2" className="form-select" value={column2} onChange={(e) => setColumn2(e.target.value)}>
                            {csvHeaders.map(header => <option key={header} value={header}>{header}</option>)}
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label htmlFor="annotationColumn" className="form-label">アノテーションカラム (任意)</label>
                          <select id="annotationColumn" className="form-select" value={annotationColumn} onChange={(e) => setAnnotationColumn(e.target.value)}>
                            <option value="">選択しない</option>
                            {csvHeaders.map(header => <option key={header} value={header}>{header}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                className="btn btn-primary mt-3"
                onClick={handleStartComparison}
                disabled={(inputMode === 'text' ? (!list1.trim() || !list2.trim()) : !csvFile) || labels.length === 0}
              >
                比較開始
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="progress mb-3">
              <div 
                className="progress-bar" 
                role="progressbar" 
                style={{width: `${progress}%`}} 
                aria-valuenow={progress} 
                aria-valuemin={0} 
                aria-valuemax={100}
              >
                {Math.round(progress)}%
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-body text-center">
                    <h5 className="card-title">リスト1の単語</h5>
                    <p className="card-text fs-4">{pairs[currentIndex]?.[0]}</p>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-body text-center">
                    <h5 className="card-title">リスト2の単語</h5>
                    <p className="card-text fs-4">{pairs[currentIndex]?.[1]}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center my-4">
              {labels.map(label => (
                <button 
                  key={label} 
                  className={`btn ${results[currentIndex] === label ? 'btn-success' : 'btn-primary'} mx-2`} 
                  onClick={() => handleJudgment(label)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="input-group mb-3">
              <input 
                type="text" 
                className="form-control" 
                placeholder="新しいラベル" 
                value={newLabel} 
                onChange={(e) => setNewLabel(e.target.value)} 
              />
              <button className="btn btn-outline-secondary" type="button" onClick={handleAddNewLabel}>追加</button>
            </div>

            <div className="d-flex justify-content-between my-4">
              <button className="btn btn-secondary" onClick={handlePrevious} disabled={currentIndex === 0}>
                前へ
              </button>
              <button className="btn btn-secondary" onClick={handleNext} disabled={currentIndex >= pairs.length - 1}>
                次へ
              </button>
            </div>

            <div className="card">
              <div className="card-header">
                判定結果
              </div>
              <div className="card-body" style={{maxHeight: '400px', overflowY: 'auto'}}>
                <table className="table table-striped table-hover">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">リスト1</th>
                      <th scope="col">リスト2</th>
                      <th scope="col">判定</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairs.map((pair, index) => (
                      <tr key={index} className={index === currentIndex ? 'table-primary' : ''}>
                        <th scope="row">{index + 1}</th>
                        <td>{pair[0]}</td>
                        <td>{pair[1]}</td>
                        <td>{results[index] || '未判定'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-3">
              <button className="btn btn-warning" onClick={handleReset}>
                リセット
              </button>
              <button className="btn btn-info ms-2" onClick={handleDownload}>
                結果をダウンロード
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;