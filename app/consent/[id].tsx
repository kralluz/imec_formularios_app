import React, { useState, useEffect, useContext } from 'react';
import { ScrollView, SafeAreaView, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Colors from '../../constants/Colors';
import Header from '../../components/Header';
import ConsentForm from '../../components/ConsentForm';
import { PDFDataContext } from '../context/PDFDataContext';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { generatePDF } from '@/utils/generatePdf';
import { getDetailedDeviceInfo } from '@/utils/deviceInfo';

export default function ConsentScreen() {
  const { id } = useLocalSearchParams<{ id: any }>();
  const [headerInfo, setHeaderInfo] = useState<any>({
    date: '',
    time: '',
    ip: '',
  });

  const { pdfData, setPDFData, addOrUpdateForm } = useContext(PDFDataContext)!;

  useEffect(() => {
    const fetchDeviceInfo = async () => {
      console.log('Buscando informações do dispositivo...');
      const info = await getDetailedDeviceInfo();
      console.log('Informações do dispositivo recebidas:', info);
      setHeaderInfo(info);
    };
    fetchDeviceInfo();
  }, []);

  // Função para solicitar permissão de escrita
  const requestWritePermission = () => {
    console.log('Solicitando permissão de escrita...');
    return new Promise<void>((resolve, reject) => {
      Alert.alert(
        'Permissão',
        'Você permite salvar o arquivo?',
        [
          {
            text: 'Não',
            onPress: () => {
              console.log('Permissão negada pelo usuário.');
              reject(new Error('Permissão negada'));
            },
          },
          {
            text: 'Sim',
            onPress: () => {
              console.log('Permissão concedida pelo usuário.');
              resolve();
            },
          },
        ],
        { cancelable: false }
      );
    });
  };

  const handleFormSubmit = async (data: any) => {
    try {
      console.log('Iniciando o envio do formulário...');
      // Solicita permissão para escrever o arquivo
      await requestWritePermission();
      console.log('Permissão de escrita confirmada.');

      const formattedDate = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      const formattedTime = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      console.log('Data formatada:', formattedDate);
      console.log('Hora formatada:', formattedTime);

      setPDFData((prev) => {
        const newData = {
          ...prev,
          header: {
            ...prev.header,
            ...headerInfo,
            formatted: `${formattedDate} às ${formattedTime}`,
          },
          consent: data,
        };
        console.log('PDFData atualizado no contexto:', newData);
        return newData;
      });

      const completePDFData: any = {
        header: {
          ...headerInfo,
          formatted: `${formattedDate} às ${formattedTime}`,
          date: formattedDate,
          time: formattedTime,
          ip: headerInfo.ip,
        },
        cpf: data.cpf || '',
        rg: data.rg || '',
        birthDate: data.birthDate || '',
        responses: pdfData.responses,
        signature: data.signature || '',
      };

      console.log(
        'Dados completos do PDF (antes de persistir):',
        completePDFData
      );

      const completePDFDataWhitoutSignature = { ...completePDFData };
      delete completePDFDataWhitoutSignature.signature;
      console.log(
        'Dados completos sem assinatura:',
        completePDFDataWhitoutSignature
      );

      console.log('Persistindo dados do formulário...');
      await addOrUpdateForm(completePDFData);
      console.log('Dados persistidos com sucesso.');

      console.log('Gerando PDF...');
      const pdfPath = await generatePDF(completePDFData);
      console.log('PDF gerado no caminho:', pdfPath);

      const destinationPath = FileSystem.documentDirectory + 'document.pdf';
      console.log('Destino do PDF:', destinationPath);

      const fileInfo = await FileSystem.getInfoAsync(destinationPath);
      console.log('Informações do arquivo destino:', fileInfo);
      if (fileInfo.exists) {
        console.log(
          'Arquivo existente encontrado. Excluindo arquivo existente...'
        );
        await FileSystem.deleteAsync(destinationPath, { idempotent: true });
      }

      console.log('Movendo PDF gerado para destino...');
      await FileSystem.moveAsync({
        from: pdfPath,
        to: destinationPath,
      });
      console.log('PDF movido para destino com sucesso.');

      const isAvailable = await Sharing.isAvailableAsync();
      console.log('Compartilhamento disponível:', isAvailable);
      if (!isAvailable) {
        Alert.alert(
          'Compartilhamento não disponível',
          'Este dispositivo não suporta compartilhamento de arquivos.'
        );
        return;
      }

      console.log('Iniciando compartilhamento do PDF...');
      await Sharing.shareAsync(destinationPath, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartilhar PDF',
      });
      console.log('Compartilhamento realizado com sucesso.');

      router.push('/success');
    } catch (error) {
      console.error('Erro ao gerar ou compartilhar o PDF:', error);
      Alert.alert('Erro', 'Não foi possível gerar ou compartilhar o PDF.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header headerInfo={headerInfo} />
      <ScrollView style={styles.scrollView}>
        <ConsentForm onSubmit={handleFormSubmit} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
});
